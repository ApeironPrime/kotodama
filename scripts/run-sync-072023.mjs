import { syncExam } from './sync-n3-youtube-all.mjs'

async function run() {
  await syncExam({
    videoId: 'ojEXWTFZuWo',
    examId: 'cm2u2y1xl01d2134ilubjx79d-listening',
    localAudioFileName: 'jlpt-n3-2023-07.mp3',
  })
}

run().catch(console.error)
