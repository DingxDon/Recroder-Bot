import { pipeline } from "@xenova/transformers";
import { execSync } from "child_process";
import * as WavDecoder from "wav-decoder";
const transcriber = await pipeline(
  "automatic-speech-recognition",
  "Xenova/whisper-tiny"
);

export async function getTranscribe(filePath) {
  const wavBuffer = execSync(
    `ffmpeg -i "${filePath}" -vn -ar 16000 -ac 1 -f wav pipe:1 -y -loglevel error`,
    { encoding: "buffer", maxBuffer: 1024 * 1024 * 50 }
  );
  const audioData = await WavDecoder.decode(wavBuffer);
  const result = await transcriber(audioData.channelData[0]);
  console.log(`Transcription result:`, result);

  return result?.text;
}
