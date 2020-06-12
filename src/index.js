import { ApolloServer, gql } from 'apollo-server'
import scraper from './scraper.js'
import typeDefs from './graphql-schema.js'
import thumb from './thumb'

const THUMBOR_URL = process.env.THUMBOR_URL || 'http://localhost:8888'

async function getThumb(url, width, height) {
  const w = width > 0 ? width : 0
  const h = height > 0 ? height : 0

  if (w === 0 && h === 0) {
    return url
  }

  // return await thumb(url, 300)
  return `${THUMBOR_URL}/unsafe/${w}x${h}/center/middle/${url}`
}

const resolvers = {
  Query: {
    async embed(obj, { url }, ctx, info) {
      return await scraper.fetch(url)
    },
  },
  Embed: {
    image: async (parent, {width, height}, ctx, info) => {
      return { url: getThumb(parent.image, width, height) }
    },
    logo: async (parent, {width, height}, ctx, info) => {
      return { url: getThumb(parent.logo, width, height) }
    }
  },
  Image: {
    url: async (parent, params, ctx, info) => {
      return parent.url
    }
  }
}

const server = new ApolloServer({ 
  typeDefs, 
  resolvers,
  playground: {
    tabs: [
      {
        endpoint: 'http://localhost:3050',
        query: `{
          embed(url: "https://www.facebook.com/humandiscoveriesshow/videos/2489459867992930/") {
            video
            title
            description
            image(width: 340) {
              url
            }
            author
            type
            date
            url
            audio
            logo(height: 36) {
              url
            }
            lang
            publisher
            embed
            sources
          }
        }`
      }
    ]
  }
})

if (process.env.NODE_ENV !== 'production') {
  process.env.DEBUG = true
}

server.listen({ port: 3050 }).then(({ url }) => {
  console.log(`🚀 Nitro Embed - Server is ready at ${url}`)
  console.log(`THUMBOR_URL: ${THUMBOR_URL}`)
  console.log(`THUMBOR_KEY (YES/NO): ${THUMBOR_KEY ? 'YES' : 'NO'}`)
})
