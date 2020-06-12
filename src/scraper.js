const metascraper = require('metascraper')([
  require('metascraper-author')(),
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-lang')(),
  require('metascraper-lang-detector')(),
  require('metascraper-logo')(),
  require('metascraper-logo-favicon')(),
  // require('metascraper-clearbit-logo')(),
  require('metascraper-publisher')(),
  require('metascraper-title')(),
  require('metascraper-url')(),
  require('metascraper-audio')(),
  require('metascraper-soundcloud')(),
  require('metascraper-video')(),
  require('metascraper-media-provider')()
  // require('metascraper-youtube')()

  // require('./rules/metascraper-embed')()
])
const { ApolloError } = require('apollo-server')
const parseUrl = require('url')

const fetch = require('node-fetch')
const find = require('lodash/find')
const isEmpty = require('lodash/isEmpty')
const each = require('lodash/each')
const isArray = require('lodash/isArray')
const mergeWith = require('lodash/mergeWith')
const urlParser = require('url')

// quick in memory cache
let cache = {}

let oEmbedProviders = []
const getEmbedProviders = async () => {
  let providers = await fetch('https://oembed.com/providers.json')
  providers = await providers.json()
  oEmbedProviders = providers
  return providers
}
getEmbedProviders()

const removeEmptyAttrs = obj => {
  let output = {}
  each(obj, (o, k) => {
    if (!isEmpty(o)) {
      output[k] = o
    }
  })
  return output
}

const scraper = {
  async fetch(targetUrl) {
    if (targetUrl.indexOf('//youtu.be/')) {
      // replace youtu.be to get proper results
      targetUrl = targetUrl.replace('//youtu.be/', '//youtube.com/')
    }

    if (cache[targetUrl]) {
      return cache[targetUrl]
    }

    const url = parseUrl.parse(targetUrl, true)

    let meta = {}
    let embed = {}

    // only get data from requested services
    await Promise.all([
      new Promise(async (resolve, reject) => {
        try {
          meta = await scraper.fetchMeta(targetUrl)
          resolve()
        } catch(err) {
          if (process.env.DEBUG) {
            console.error(`ERROR at fetchMeta | ${err.message}`)
          }
          resolve()
        }
      }),
      new Promise(async (resolve, reject) => {
        try {
          embed = await scraper.fetchEmbed(targetUrl)
          resolve()
        } catch(err) {
          if (process.env.DEBUG) {
            console.error(`ERROR at fetchEmbed | ${err.message}`)
          }
          resolve()
        }
      })
    ])

    const output = mergeWith(
      meta,
      embed,
      (objValue, srcValue) => {
        if (isArray(objValue)) {
          return objValue.concat(srcValue);
        }
      }
    )

    if (isEmpty(output)) {
      throw new ApolloError('Not found', 'NOT_FOUND')
    }

    // fix youtube start parameter
    const youTubeStartParam = url.query.t || url.query.start
    if (output.publisher === 'YouTube' && youTubeStartParam) {
      output.embed = output.embed.replace('?feature=oembed', `?feature=oembed&start=${youTubeStartParam}`)
      output.url += `&start=${youTubeStartParam}`
    }
    if (output.publisher === 'YouTube') {
      output.embed = output.embed.replace('?feature-oembed', '?feature=oembed&autoplay=1')
    }

    // DTube?
    // https://d.tube/#!/v/blockchaindeveloper81/QmTDuWfr7rYiLCC4ftQk17vzb55tH8nCWZ8xCWZAnqGqZM

    // write to cache
    cache[targetUrl] = output

    return output
  },
  async fetchEmbed(targetUrl) {
    const url = urlParser.parse(targetUrl)
    const embedMeta = find(oEmbedProviders, provider => {
      return provider.provider_url.indexOf(url.hostname) >= 0
    })
    if (!embedMeta) {
      return {}
    }
    const embedUrl = embedMeta.endpoints[0].url.replace('{format}', 'json')

    let data
    try {
      data = await fetch(`${embedUrl}?url=${targetUrl}`)
      data = await data.json()
    } catch (err) {
      data = await fetch(`${embedUrl}?url=${targetUrl}&format=json`)
      data = await data.json()
    }
    if (data) {
      let output = {
        type: data.type || 'link',
        embed: data.html,
        author: data.author_name,
        date: data.upload_date ? new Date(data.upload_date).toISOString() : null
      }

      output.sources = ['oembed']

      return output
    }
    return {}
  },
  async fetchMeta(targetUrl) {

    // const parsedURL = urlParser.parse(targetUrl)
    // console.log(parsedURL)

    // get from cache
    let html = await fetch(targetUrl)
    html = await html.text()
    const metadata = await metascraper({ html, url: targetUrl })

    metadata.sources = ['resource']
    metadata.type = 'link'

    return metadata
  }
}

module.exports = scraper
