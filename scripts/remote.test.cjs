const assert = require('node:assert/strict')
const vm = require('node:vm')
const { buildSync } = require('esbuild')
const { test } = require('node:test')
const { EventEmitter } = require('node:events')
const code = buildSync({
  entryPoints: ['src/main/power.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  external: ['electron']
}).outputFiles[0].text
// JavaScript test harness cannot use TypeScript return annotations.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function load(overrides = {}) {
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => overrides[name] ?? require(name),
    Buffer,
    setTimeout,
    clearTimeout,
    process
  })
  return module.exports
}
test('WOL packet contains six FF bytes and sixteen MAC copies', () => {
  const { magicPacket } = load()
  const packet = magicPacket('02:11:22:33:44:55')
  assert.equal(packet.length, 102)
  assert.equal(packet.subarray(0, 6).toString('hex'), 'ffffffffffff')
  for (let i = 0; i < 16; i++)
    assert.equal(packet.subarray(6 + i * 6, 12 + i * 6).toString('hex'), '021122334455')
  for (const mac of ['bad', '00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF'])
    assert.throws(() => magicPacket(mac))
})
test('WOL sends to the configured broadcast and closes socket', async () => {
  let closed = false
  const socket = new EventEmitter()
  socket.bind = (_, callback) => callback()
  socket.setBroadcast = (enabled) => assert.equal(enabled, true)
  socket.send = (packet, port, address, callback) => {
    assert.equal(packet.length, 102)
    assert.equal(port, 9)
    assert.equal(address, '192.168.1.255')
    callback(null)
  }
  socket.close = () => {
    closed = true
  }
  await load({ 'node:dgram': { createSocket: () => socket } }).wakePC({
    ip: '192.168.1.20',
    mac: '02:11:22:33:44:55',
    broadcast: '192.168.1.255'
  })
  assert.equal(closed, true)
})
test('SSH shutdown uses fixed command and rejects unsafe users before execution', async () => {
  let calls = 0
  const { shutdownPC } = load({
    'node:child_process': {
      execFile: (command, args, options, callback) => {
        calls++
        assert.equal(command, 'ssh')
        assert.ok(args.includes('StrictHostKeyChecking=yes'))
        assert.ok(args.includes('BatchMode=yes'))
        assert.equal(args.at(-1), 'shutdown.exe /s /t 0')
        assert.equal(options.timeout, 12000)
        callback(null, '', '')
      }
    }
  })
  const target = { ip: '192.168.1.20', shutdownMethod: 'ssh', sshUser: 'operator', sshPort: 22 }
  await shutdownPC(target)
  await assert.rejects(shutdownPC({ ...target, sshUser: 'operator;whoami' }))
  await assert.rejects(shutdownPC({ ...target, ip: 'host;whoami' }))
  assert.equal(calls, 1)
})
test('command failure is reported instead of success', async () => {
  const { shutdownPC } = load({
    'node:child_process': {
      execFile: (_command, _args, _options, callback) =>
        callback(new Error('failed'), '', 'Permission denied')
    }
  })
  await assert.rejects(
    shutdownPC({ ip: '192.168.1.20', shutdownMethod: 'ssh', sshUser: 'operator', sshPort: 22 }),
    /Permission denied/
  )
})
