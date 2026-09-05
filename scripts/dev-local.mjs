import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const processNames = [
  'api',
  'media:worker',
  ...(process.env.TRANSCRIPTION_PROVIDER === 'local_whisper' ? ['asr:local'] : []),
  'dev',
]
const children = processNames.map((script) =>
  spawn(npmCommand, ['run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: false,
    shell: process.platform === 'win32',
  })
)

let stopping = false
function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL')
    process.exit(exitCode)
  }, 5_000).unref()
}

process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

for (const [index, child] of children.entries()) {
  const name = processNames[index]
  child.once('error', (error) => {
    console.error(`Không thể khởi động ${name}: ${error.message}`)
    if (name !== 'asr:local') stop(1)
  })
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${name} đã dừng (${signal ?? `mã ${code ?? 1}`}).`)
      if (name !== 'asr:local') stop(code ?? 1)
    }
  })
}
