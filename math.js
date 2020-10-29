const seneca = require('seneca')()
const { registerService, lookupService } = require('./registry-helper')
const SENECA_CONFIG = { host: '127.0.0.1', port: 9988 }

const SERVICE_PORT = 10101

registerService({ seneca, ...SENECA_CONFIG }, 'math-utils', SERVICE_PORT)((seneca) => {
    seneca.add('role:math,cmd:sum', async function (msg, response) {

        const { actAsync } = await lookupService(SENECA_CONFIG, 'generic')
        const { message } = await actAsync({ role: 'local', cmd: 'info', name: 'Seneca' })
        return response(null, { anwser: Number(msg.left) + Number(msg.right), message })

    }).listen({ port: SERVICE_PORT })
})