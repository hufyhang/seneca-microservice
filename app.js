const log4js = require('log4js')
const SenecaWeb = require('seneca-web')
const Express = require('express')
const { Router } = Express
const context = new Router()

const logger = log4js.getLogger()
logger.level = 'info'

process.on('uncaughtException', (err) => {
  logger.error('Caught exception: ' + err)
})

const senecaWebConfig = {
    context,
    adapter: require('seneca-web-adapter-express'),
    options: {
        parseBody: false
    }
}

const app = Express()
    .use(require('body-parser').json({ limit: '2gb' }))
    .use(context)
    .listen(3030)

const seneca = require('seneca')()

seneca.use(SenecaWeb, senecaWebConfig)
    .use('api')

