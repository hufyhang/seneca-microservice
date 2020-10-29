const { lookupService } = require('./registry-helper')
const REGISTRY_CONFIG = { host: '127.0.0.1', port: 9988 }

module.exports = async function api(options) {
  this.add('role:api,path:calculate', async function (msg, response) {
    const { operation } = msg.args.params
    const { left, right } = msg.args.body
    const { actAsync } = await lookupService(REGISTRY_CONFIG, 'math-utils')
    const result = await actAsync({
      role: 'math',
      cmd: operation,
      left,
      right
    })

    return response(result)
  })

  this.add('role:api, path:greeting', async (msg, response) => {
    msg.response$.status(401)
    const { name } = msg.args.body
    const { actAsync } = await lookupService(REGISTRY_CONFIG, 'generic')
    const result = await actAsync({
      role: 'local',
      cmd: 'info',
      name
    })

    return response(result)
  })

  this.add('init:api', function (msg, response) {
    this.act('role:web', {
      routes: {
        prefix: '/api',
        pin: 'role:api,path:*',
        map: {
          calculate: { POST: true, suffix: '/:operation' },
          greeting: { POST: true }
        }
      }
    }, response)
  })
}
