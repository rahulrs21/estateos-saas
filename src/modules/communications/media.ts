/*
 * Recordings and transcripts (docs/CALL_PRIVACY_COMPLIANCE.md#recording-transcripts-and-consent).
 * Files are checked by their contents, never by name or declared type:
 * WAV (PCM, duration from its header) and MP3 (duration from its frames).
 * Transcripts from an approved external service are read from WebVTT, SRT or
 * plain text into timestamped segments. Language detection is an estimate.
 */

export const MAX_RECORDING_BYTES = 30 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 4 * 60 * 60;
/** A recording may run a little longer than the logged call (dialling, hold). */
export const RECORDING_DURATION_TOLERANCE_SECONDS = 120;
export const MAX_TRANSCRIPT_BYTES = 1024 * 1024;
export const MAX_TRANSCRIPT_SEGMENTS = 5000;
const MAX_SEGMENT_CHARS = 2000;

export type AudioType = "audio/wav" | "audio/mpeg";
export interface AudioFacts {contentType: AudioType; extension: "wav" | "mp3"; durationSeconds: number}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const u16 = (bytes: Uint8Array, at: number) => bytes[at] | (bytes[at + 1] << 8);
const u32 = (bytes: Uint8Array, at: number) => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;

function wavFacts(bytes: Uint8Array): AudioFacts | null {
  if (bytes.length < 44 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WAVE") return null;
  let byteRate = 0, dataSize = -1;
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = ascii(bytes, at, 4), size = u32(bytes, at + 4);
    if (id === "fmt " && size >= 16) {
      if (u16(bytes, at + 8) !== 1) return null; // PCM only
      byteRate = u32(bytes, at + 16);
    }
    if (id === "data") { dataSize = Math.min(size, bytes.length - at - 8); break; }
    at += 8 + size + (size % 2);
  }
  if (!byteRate || dataSize < 0) return null;
  return {contentType: "audio/wav", extension: "wav", durationSeconds: Math.round(dataSize / byteRate)};
}

// MPEG audio Layer III frame tables (kbps; Hz).
const MPEG1_L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = {3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000]};

function mp3Facts(bytes: Uint8Array): AudioFacts | null {
  let at = 0;
  if (ascii(bytes, 0, 3) === "ID3" && bytes.length > 10) {
    at = 10 + ((bytes[6] & 0x7f) << 21 | (bytes[7] & 0x7f) << 14 | (bytes[8] & 0x7f) << 7 | (bytes[9] & 0x7f));
  }
  let seconds = 0, frames = 0;
  while (at + 4 <= bytes.length && frames < 1_000_000) {
    if (bytes[at] !== 0xff || (bytes[at + 1] & 0xe0) !== 0xe0) {
      if (frames === 0) return null; // the first frame must follow the tag directly
      break;
    }
    const version = (bytes[at + 1] >> 3) & 0x03, layer = (bytes[at + 1] >> 1) & 0x03;
    const bitrateIndex = bytes[at + 2] >> 4, rateIndex = (bytes[at + 2] >> 2) & 0x03, padding = (bytes[at + 2] >> 1) & 0x01;
    if (layer !== 1 || version === 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return frames ? {contentType: "audio/mpeg", extension: "mp3", durationSeconds: Math.round(seconds)} : null;
    const sampleRate = SAMPLE_RATES[version][rateIndex];
    const bitrate = (version === 3 ? MPEG1_L3_BITRATES : MPEG2_L3_BITRATES)[bitrateIndex] * 1000;
    const samples = version === 3 ? 1152 : 576;
    const length = Math.floor(samples / 8 * bitrate / sampleRate) + padding;
    if (length < 4) return null;
    seconds += samples / sampleRate;
    frames += 1;
    at += length;
  }
  return frames >= 2 ? {contentType: "audio/mpeg", extension: "mp3", durationSeconds: Math.round(seconds)} : null;
}

/** The audio type and duration from the file's contents, or null when it is not a supported recording. */
export function audioFacts(bytes: Uint8Array): AudioFacts | null {
  return wavFacts(bytes) ?? mp3Facts(bytes);
}

export interface TranscriptSegment {id: number; startSeconds: number | null; endSeconds: number | null; speaker: string | null; text: string}
export interface ParsedTranscript {format: "VTT" | "SRT" | "TEXT"; segments: TranscriptSegment[]; hasTimestamps: boolean}

export class TranscriptFormatError extends Error {
  constructor(message: string) { super(message); this.name = "TranscriptFormatError"; }
}

const TIMING = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/;

function seconds(value: string) {
  const parts = value.replace(",", ".").split(":").map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  return Math.round((h * 3600 + m * 60 + s) * 1000) / 1000;
}

/** Removes markup (VTT voice and style tags) and control characters; keeps the words. */
function clean(text: string) {
  return text.replace(/<[^>]{0,200}>/g, "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_SEGMENT_CHARS);
}

function speakerOf(raw: string, text: string): {speaker: string | null; text: string} {
  const voice = /<v(?:\.[^ >]*)?\s+([^>]{1,60})>/.exec(raw);
  if (voice) return {speaker: clean(voice[1]), text};
  const labelled = /^([\p{L}][\p{L}\p{N} .'-]{0,40}):\s+(.+)$/u.exec(text);
  return labelled ? {speaker: labelled[1].trim(), text: labelled[2].trim()} : {speaker: null, text};
}

function cues(text: string, format: "VTT" | "SRT"): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const timingAt = lines.findIndex(line => TIMING.test(line));
    if (timingAt < 0) continue;
    const [, start, end] = TIMING.exec(lines[timingAt])!;
    const raw = lines.slice(timingAt + 1).join(" ");
    const words = clean(raw);
    if (!words) continue;
    segments.push({id: segments.length + 1, startSeconds: seconds(start), endSeconds: seconds(end), ...speakerOf(raw, words)});
    if (segments.length > MAX_TRANSCRIPT_SEGMENTS) throw new TranscriptFormatError(`A transcript can have at most ${MAX_TRANSCRIPT_SEGMENTS} segments.`);
  }
  if (!segments.length) throw new TranscriptFormatError(`No timed lines were found in this ${format === "VTT" ? "WebVTT" : "SRT"} file.`);
  return segments;
}

export function parseTranscript(text: string): ParsedTranscript {
  if (new TextEncoder().encode(text).length > MAX_TRANSCRIPT_BYTES) throw new TranscriptFormatError("Transcript files can be at most 1 MB.");
  const body = text.replace(/^﻿/, "");
  if (/^WEBVTT/.test(body)) return {format: "VTT", segments: cues(body, "VTT"), hasTimestamps: true};
  if (/^\s*\d+\s*\r?\n\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->/.test(body)) return {format: "SRT", segments: cues(body, "SRT"), hasTimestamps: true};
  const segments: TranscriptSegment[] = [];
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const words = clean(line);
    if (!words) continue;
    segments.push({id: segments.length + 1, startSeconds: null, endSeconds: null, ...speakerOf(line, words)});
    if (segments.length > MAX_TRANSCRIPT_SEGMENTS) throw new TranscriptFormatError(`A transcript can have at most ${MAX_TRANSCRIPT_SEGMENTS} lines.`);
  }
  if (!segments.length) throw new TranscriptFormatError("The transcript is empty.");
  return {format: "TEXT", segments, hasTimestamps: false};
}

/** en, ar, mixed or unknown from the share of Arabic and Latin letters (an estimate, shown as such). */
export function detectLanguage(text: string): "en" | "ar" | "mixed" | "unknown" {
  const arabic = (text.match(/[؀-ۿݐ-ݿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const letters = arabic + latin;
  if (letters < 20) return "unknown";
  if (arabic / letters >= 0.85) return "ar";
  if (latin / letters >= 0.85) return "en";
  return "mixed";
}

export const LANGUAGE_LABELS: Record<string, string> = {en: "English", ar: "Arabic", mixed: "English and Arabic", unknown: "Not detected"};

/** "1:05" or "1:02:05" for transcript timestamps. */
export function timestamp(value: number | null) {
  if (value === null) return "";
  const total = Math.floor(value), h = Math.floor(total / 3600), m = Math.floor(total % 3600 / 60), s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
