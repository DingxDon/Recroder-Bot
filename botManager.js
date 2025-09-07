import { getTranscribe } from "./transcribe.js";

export let meetings = [];

export async function createMeeting(payload) {
  return {
    id: payload.id,
    isRecording: {
      audio: payload.isRecording?.audio ?? false,
      video: payload.isRecording?.video ?? false,
    },
    isStopped: payload.isStopped ?? false,
    page: null,
    stream: null,
    filePath: null,
  };
}

export async function BotManager(obj, stop = false) {
  const { id } = obj;
  let meeting = meetings.find((m) => m.id === id);

  if (stop && meeting) {
    meeting.isStopped = true;
    if (meeting.stream) await meeting.stream.destroy();
    if (meeting.page) await meeting.page.close();
    const transcribe = await getTranscribe(meeting.filePath);
    console.log(transcribe, "transcribed text");
  } else if (!stop) {
    if (!meeting) {
      meetings.push(await createMeeting(obj));
    } else {
      meeting.isStopped = false;
    }
  }
  return meetings;
}
