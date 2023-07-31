import React, { useState, useEffect } from 'react';

import { Box, Modal, ModalClose, ModalDialog, Stack, Typography, Sheet } from '@mui/joy';
import MicIcon from '@mui/icons-material/Mic';

// 声明全局的webkitAudioContext类型
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

declare class SpeechGrammar {
  src: string;
  weight?: number;
}

interface SpeechGrammarList {
  length: number;
  item(index: number): SpeechGrammar | null;
}

declare class SpeechRecognitionEvent extends Event {
  constructor(
    type: string,
    eventInitDict?: {
      resultIndex?: number;
      results?: SpeechRecognitionResultList;
      interpretation?: any;
    },
  );

  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
  readonly interpretation: any;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionResult {
  isFinal: any;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

declare class SpeechRecognition extends EventTarget {
  constructor();

  grammars: SpeechGrammarList;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  serviceURI: string;

  start(): void;
  stop(): void;
  abort(): void;

  onstart: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
  onend: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognitionErrorEvent, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognitionEvent, ev: SpeechRecognitionEvent) => any) | null;
  onnomatch: ((this: SpeechRecognitionEvent, ev: SpeechRecognitionErrorEvent) => any) | null;
  onaudioend: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognitionEvent, ev: Event) => any) | null;
}

// 如果你的浏览器支持 webkitSpeechRecognition，请添加以下声明
declare class webkitSpeechRecognition extends SpeechRecognition {}

type RecordingState = 'start' | 'listening' | 'end';

export function Voice({ open, onClose }: { open: boolean; onClose: (param: string) => void }) {
  const [recordingState, setRecordingState] = useState<RecordingState>('start');
  const [message, setMessage] = useState('请开始讲话');
  const [audioLevel, setAudioLevel] = useState<number>(0); // 保存音频水平值

  useEffect(() => {
    // 创建音频上下文对象
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    let mediaStream: MediaStream | null = null;
    let analyser: AnalyserNode | null = null;
    let recognition: SpeechRecognition | null = null;

    const startListening = async () => {
      try {
        // 获取用户麦克风输入流
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // 创建分析器节点
        analyser = audioContext.createAnalyser();
        if (mediaStream) {
          // 将麦克风输入流连接到分析器节点
          const source = audioContext.createMediaStreamSource(mediaStream);
          source.connect(analyser);

          // 设置分析器节点的参数
          analyser.fftSize = 256;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateAudioLevel = () => {
            // 获取音频数据
            analyser?.getByteFrequencyData(dataArray);
            // 计算音频能量
            const totalEnergy = dataArray.reduce((acc, cur) => acc + cur, 0);
            // 计算音频水平值
            const audioLevel = (totalEnergy / bufferLength) * 2;
            // 更新音频水平值
            setAudioLevel(audioLevel);

            // 递归调用更新音频水平值
            requestAnimationFrame(updateAudioLevel);
          };

          // 开始更新音频水平值
          updateAudioLevel();
        }
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    };

    const startSpeechRecognition = () => {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      recognition.onstart = () => {
        console.log('开始录音');
      };

      recognition.onresult = (event) => {
        setMessage(event.results[0][0].transcript);
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        setRecordingState('end');
      };

      recognition.onerror = (event: Event) => {
        const speechRecognitionErrorEvent = event as SpeechRecognitionErrorEvent;
        console.error('Speech recognition error:', speechRecognitionErrorEvent.error);
      };

      recognition.start();
    };

    if (recordingState === 'listening') {
      console.log('useEffect', '开始监听视频');
      startListening();
      startSpeechRecognition();
    }

    return () => {
      // 停止监听并释放资源
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
      if (analyser) {
        analyser.disconnect();
      }
      if (recognition) {
        recognition.stop();
      }
    };
  }, [recordingState]);

  useEffect(() => {
    let timer: any = null;
    if (open) {
      timer = setTimeout(() => {
        setRecordingState('listening');
        setMessage('正在收听...');
      }, 2000);
    } else {
      setRecordingState('start');
      setMessage('请开始讲话');
    }

    return () => clearTimeout(timer);
  }, [open]);

  const handleClose = () => {
    onClose(message);
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog layout="fullscreen" sx={{ minWidth: '60vw' }}>
        <ModalClose />
        <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ height: '100vw', pb: 25 }}>
          <Box width="40vw" height="20vw" display="flex" flexDirection="column" justifyContent="center" sx={{ mr: 10 }}>
            <Typography level="body5" fontSize="xl4">
              {/* 请帮我查询一下附近的酒店，谢谢。请帮我查询一下附近的酒店，谢谢。 level="body1" */}
              {message}
            </Typography>
          </Box>
          <Sheet
            variant={recordingState === 'listening' ? 'solid' : 'plain'}
            color="primary"
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '10vw',
              height: '10vw',
              borderRadius: '50%',
              boxShadow: '0px 0px 8px rgba(0, 0, 0, 0.1)',
              shadow: 'sm',
              transformStyle: 'preserve-3d',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) translateZ(-1px)',
                width: recordingState === 'listening' ? `${100 + audioLevel}%` : '100%',
                height: recordingState === 'listening' ? `${100 + audioLevel}%` : '100%',
                borderRadius: '50%',
                backgroundColor: 'primary.100',
              },
            }}
          >
            <MicIcon sx={{ width: '5vw', height: '5vw' }} />
          </Sheet>
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
