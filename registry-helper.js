const address = require('address')
const log4js = require('log4js')
const logger = log4js.getLogger()

logger.level = 'info'

const registerService = (senecaOption, name, port) => {
  const { seneca, registry: registryHost = '127.0.0.1', port: registryPort = 9988 } = senecaOption
  logger.info(`Attempt to register service "${name}" [${address.ip()}:${port}] to registry[${registryHost}]`)

  const teardown = (callback) => {
    seneca.client({ host: registryHost, port: registryPort, type: 'tcp' })
      .act({
        role: 'registry',
        cmd: 'teardown',
        name,
        port,
        host: address.ip()
      }, callback)
  }

  process.on('SIGINT', () => {
    teardown(() => {
      process.exit(0)
    })
  })
  process.on('exit', () => {
    teardown()
  })

  return (fn) => {
    return seneca.client({ host: registryHost, port: registryPort, type: 'tcp' })
      .act({
        role: 'registry',
        cmd: 'add',
        name,
        port,
        host: address.ip()
      }, fn.bind(null, seneca))
  }
}

const lookupService = ({ registry: registryHost = '127.0.0.1', port: registryPort = 9988 }, name) => {
  return new Promise((resolve, reject) => {
    logger.info(`Start to lookup service "${name}" in registry[${registryHost}].`)
    const seneca = require('seneca')()
    seneca.client({ host: registryHost, port: registryPort, type: 'tcp' }).act({
      role: 'registry',
      cmd: 'get',
      name
    }, (err, result) => {
      if (err) {
        seneca.close()
        reject(err)
      }

      const { hasService, host, port } = result
      if (!hasService) {
        logger.info(`No services named "${name}" were found in registry[${registryHost}].`)
        seneca.close()
        resolve({
          ...result,
          client: undefined,
          actAsync: undefined
        })
      }

      logger.info(`Service "${name}", available @ ${host}:${port}, was found in registry[${registryHost}].`)
      const client = seneca.client({ host, port })
      const actAsync = (option) => {
        return new Promise((resolve, reject) => {
          const actString = Object.entries(option).map(([k, v]) => `${k}:${v}`).join(', ')

          logger.info(`Act "${actString}" on ${name}[${host}:${port}]`)
          client.act(option, (err, result) => {
            if (err) {
            logger.error(`Error occurred when acting "${actString}" on ${name}[${host}:${port}]. ${err}`)
              seneca.close()
              reject(err)
            }

            logger.info(`Finished acting "${actString}" on ${name}[${host}:${port}].`)
            seneca.close()
            resolve(result)
          })
        })
      }

      seneca.close()
      resolve({ ...result, client, actAsync })
    })
  })
}

module.exports = {
  registerService,
  lookupService
}
