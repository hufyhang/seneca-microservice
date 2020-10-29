/**
 * Redis-powered service registry for seneca micro-services.
 */

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

let redis, delRedisAsync, existsRedisAsync, sremRedisAsync, saddRedisAsync, scardRedisAsync, smembersRedisAsync = null

if (typeof redisConfig === 'string') {
    const { promisify } = require('util')
    redis = Redis.createClient({ url: redisConfig })
    existsRedisAsync = promisify(redis.exists).bind(redis)
    sremRedisAsync = promisify(redis.srem).bind(redis)
    saddRedisAsync = promisify(redis.sadd).bind(redis)
    scardRedisAsync = promisify(redis.scard).bind(redis)
    smembersRedisAsync = promisify(redis.smembers).bind(redis)
    delRedisAsync = promisify(redis.del).bind(redis)

    redis.on('error', (err) => {
        logger.error(`Error occurred in Redis. ${ err }`)
    })
}

const makeRedisKeyName = (name) => `${REDIS_REPO_KEY}_$$${name}`

seneca
    .add('role:registry, cmd:teardown', async (msg, done) => {
        const { name, port, host } = msg
        const serviceRedisName = makeRedisKeyName(name)
        const hasRegisteredService = await existsRedisAsync(serviceRedisName)
        if (hasRegisteredService) {
            await sremRedisAsync(serviceRedisName, JSON.stringify({ port, host }))
            const length = await scardRedisAsync(serviceRedisName)
            if (!length) {
                await delRedisAsync(serviceRedisName)
            }
        }

        logger.info(`Teardown service "${name}" [${host}:${port}] from registry.`)
        done()

    })
    .add('role:registry, cmd:add', async (msg, done) => {
        const { name, port, host } = msg
        const serviceRedisName = makeRedisKeyName(name)
        await saddRedisAsync(serviceRedisName, JSON.stringify({ port, host }))
        const length = await scardRedisAsync(serviceRedisName)

        logger.info(`Added ${name}[${host}:${port}] [Total #: ${length}] to registry.`)
        done()
    })
    .add('role:registry, cmd:get', async (msg, done) => {
        const { name } = msg
        const serviceRedisName = makeRedisKeyName(name)
        const hasRegisteredService = await existsRedisAsync(serviceRedisName)
        if (!hasRegisteredService) {
            logger.warn(`No such service "${name}" found in registry.`)
            return done(null, {
                hasService: false,
                name: undefined,
                port: undefined,
                host: undefined
            })
        }

        const length = await scardRedisAsync(serviceRedisName)
        if (!length) {
            logger.warn(`No such service "${name}" found in registry.`)
            return done(null, {
                hasService: false,
                name: undefined,
                port: undefined,
                host: undefined
            })
        }

        const serviceList = await smembersRedisAsync(serviceRedisName)
        console.log('SERVICES', serviceList)
        const balancer = new P2cBalancer(serviceList.length)
        const service = serviceList[balancer.pick()]

        const { host, port } = JSON.parse(service)
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
