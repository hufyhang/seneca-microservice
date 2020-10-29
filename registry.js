const log4js = require('log4js')
const yargs = require('yargs')
const Redis = require('redis')
const seneca = require('seneca')()
const address = require('address')
const { P2cBalancer } = require('load-balancers')

const REDIS_REPO_KEY = 'seneca_service_registry'
const logger = log4js.getLogger()

const { argv } = yargs(process.argv)

const redisConfig = argv.redis

const isLeader = argv.lead === true

logger.level = 'info'

let redis, getRedisAsync, setRedisAsync = null

if (typeof redisConfig === 'string') {
    const { promisify } = require('util')
    redis = Redis.createClient({ url: redisConfig })
    getRedisAsync = promisify(redis.get).bind(redis)
    setRedisAsync = promisify(redis.set).bind(redis)

    redis.on('error', (err) => {
        logger.error(`Error occurred in Redis. ${ err }`)
    })
}

seneca
    .add('role:registry, cmd:teardown', async (msg, done) => {
        const { name, port, host } = msg
        const _registryDict = JSON.parse(await getRedisAsync(REDIS_REPO_KEY) || '{}')

        if (!_registryDict.hasOwnProperty(name)) {
            done()
        }

        const updatedList = _registryDict[name] == null
            ? []
            :  _registryDict[name].filter((service) => service.host !== host || service.port !== port)

        const updatedDict = {
            ..._registryDict,
            [name]: updatedList.length ? updatedList : null
        }

        if (!updatedList.length) {
            delete updatedDict[name]
        }

        logger.info(`Teardown service "${name}" [${host}:${port}] from registry.`)
        await setRedisAsync(REDIS_REPO_KEY, JSON.stringify(updatedDict))
        done()

    })
    .add('role:registry, cmd:list', (msg, done) => {
        logger.info(`Listed all services in registry. ${JSON.stringify(_registryDict, null, '  ')}`)
        done(null, { ..._registryDict })
    })
    .add('role:registry, cmd:add', async (msg, done) => {
        const { name, port, host } = msg
        const _registryDict = JSON.parse(await getRedisAsync(REDIS_REPO_KEY) || '{}')
        if (!_registryDict.hasOwnProperty(name) || _registryDict[name] == null) {
            _registryDict[name] = [{ port, host }]
        } else {
            _registryDict[name].push({ port, host })
        }

        await setRedisAsync(REDIS_REPO_KEY, JSON.stringify(_registryDict))

        logger.info(`Added ${name}[${host}:${port}][Total #: ${_registryDict[name].length}] to registry.`)
        done()
    })
    .add('role:registry, cmd:get', async (msg, done) => {
        const { name } = msg
        const _registryDict = JSON.parse(await getRedisAsync(REDIS_REPO_KEY) || '{}')

        if (!_registryDict.hasOwnProperty(name) || _registryDict[name] == null) {
            logger.warn(`No such service "${name}" found in registry.`)
            done(null, {
                hasService: false,
                name: undefined,
                port: undefined,
                host: undefined
            })
        }
        const serviceList = _registryDict[name]
        const balancer = new P2cBalancer(serviceList.length)
        const service = serviceList[balancer.pick()]

        const { host, port } = service
        logger.info(`Retrieved ${name}[${host}:${port}] from registry.`)
        done(null, {
            hasService: true,
            name,
            host,
            port
        })
    })
    .listen({ port: argv.port || 9988, type: 'tcp' })
    .ready(() => {
        logger.info(`Registry up @ ${address.ip()}:${argv.port || 9988}`)
        if (isLeader) {
            logger.info('This is a LEADER registry.')
        } else if (typeof argv.lead === 'string') {
            const [leader, leaderPort] = argv.lead.split(':')
            require('seneca')().client({ host: leader, port: leaderPort, type: 'tcp' })
                .act('role: registry, cmd: list', (err, serviceDict) => {
                    Object.entries(serviceDict).forEach(([k, v]) => _registryDict[k] = v)
                    logger.info(`Synced service registry from leader[${leader}:${leaderPort}].`)
                })
                .close()
        }
    })
