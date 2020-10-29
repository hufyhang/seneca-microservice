const seneca = require('seneca')()
const { registerService } = require('./registry-helper')
const SENECA_HOST = '127.0.0.1'
const SERVICE_PORT = 10102

registerService({ seneca, host: SENECA_HOST }, 'generic', SERVICE_PORT)((seneca) => {

    seneca.add('role:local, cmd: info', (msg, reply) => {
        return reply({ message: `Hello, ${ msg.name }!你好，${msg.name}！` })
    }).listen({ port: SERVICE_PORT })

})
