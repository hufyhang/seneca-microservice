const seneca = require('seneca')()
const yargs = require('yargs')
const { registerService } = require('./registry-helper')
const REGISTRY_HOST = '127.0.0.1'

const { argv } = yargs(process.argv)

const SERVICE_PORT = argv.port || 10102

registerService({ seneca, registry: REGISTRY_HOST }, 'generic', SERVICE_PORT)((seneca) => {

    seneca.add('role:local, cmd: info', (msg, reply) => {
        return reply(null, { message: `Hello, ${ msg.name }!你好，${msg.name}！` })
    }).listen({ port: SERVICE_PORT })

})
