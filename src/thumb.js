import sharp from 'sharp'
import request from 'request'
import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import dotenv from 'dotenv'

dotenv.config()

const normalize = fileOrFolderName => {
  return decodeURIComponent(fileOrFolderName).replace(/\s+/g, '_').toLowerCase()
}
const thumb = async (url, height = 126) => {

  console.log('THUMB', url)


  const urlParts = url.replace(/^(http[s]?\:\/\/)/g, '').split('/').splice(2)
  const filename = normalize(urlParts.pop())
  const folder = normalize(urlParts.join('/').replace(/\.\.\//g), '')
  const tempDir = path.resolve(__dirname, '../public', 'tmp')
  const remote = path.resolve(tempDir, filename)
  const thumb = path.resolve(__dirname, '../public', folder, filename)
  const fileDir = path.resolve(__dirname, '../public', folder)
  const htmlPath = `${process.env.CDN || 'http://localhost:3050'}/${folder}/${filename}`

  if (fs.existsSync(thumb)) return htmlPath

  return new Promise(async resolve => {
    try {
      await mkdirp(tempDir)
      await mkdirp(fileDir)
      request(url)
        .pipe(fs.createWriteStream(remote))
        .on('close', async () => {
          if (!fs.existsSync(remote)) {
            resolve(url)
            return
          }
          if (fs.statSync(remote).size <= 1000) {
            try {
              fs.unlinkSync(remote)
            } catch (err) {}
            resolve(url)
            return
          }
          await sharp(remote)
            .resize({ height, withoutEnlargement: true })
            .toFile(thumb)
          try {
            fs.unlinkSync(remote)
          } catch (err) {}

          if (fs.statSync(thumb).size <= 1000) {
            try {
              fs.unlinkSync(thumb)
            } catch (err) {}
            resolve(url)
          } else {
            resolve(htmlPath)
          }
        })
    } catch (err) {
      if (fs.existsSync(remote)) fs.unlinkSync(remote)
      resolve(url)
    }
  })
  
}

export default thumb

// thumb('http://www.kryon.com/cartprodimages/2019%20downloads/Calgary%20graphics/Klogo.jpg')
