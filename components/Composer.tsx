import React from 'react';

import { Box, Button, Grid, ListDivider, Menu, MenuItem, Stack, Textarea } from '@mui/joy';
import TelegramIcon from '@mui/icons-material/Telegram';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import MicIcon from '@mui/icons-material/Mic';
import { Voice } from './Voice';

/// 浏览器存储: 已发历史消息

const LOCALSTORAGE_KEY_COMPOSER_HISTORY = 'app-composer-history';

const loadMessagesFromHistory = (): string[] => {
  if (typeof localStorage === 'undefined') return [];
  const storedData = localStorage.getItem(LOCALSTORAGE_KEY_COMPOSER_HISTORY);
  return storedData ? JSON.parse(storedData) : [];
};

/**
 * 用于聊天界面中编写和发送消息的组件.
 * 支持从剪贴板粘贴文本和代码，并且还提供了本地发送消息的历史记录功能.
 *
 * @param {boolean} disableSend - 用于禁用发送按钮.
 * @param {(text: string) => void} sendMessage - 用于发送已编写消息.
 */
export function Composer({ disableSend, sendMessage }: { disableSend: boolean; sendMessage: (text: string) => void }) {
  // 状态
  const [composeText, setComposeText] = React.useState('');
  const [historyAnchor, setHistoryAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const [messages, setMessages] = React.useState(loadMessagesFromHistory);

  const [isRecording, setIsRecording] = React.useState(false);

  const appendMessageToHistory = (composeText: string, maxMessages: number = 20) => {
    if (typeof localStorage === 'undefined') return;
    // 新消息添加到顶部, 移除重复消息 (策略 '冒泡到顶部')
    const optimizedText = composeText.trim();
    const composedMessages = loadMessagesFromHistory().filter((m) => m.trim() !== optimizedText);
    composedMessages.unshift(composeText);
    localStorage.setItem(LOCALSTORAGE_KEY_COMPOSER_HISTORY, JSON.stringify(composedMessages.slice(0, maxMessages)));
  };

  const clearMessageHistory = () => {
    setMessages([]);

    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LOCALSTORAGE_KEY_COMPOSER_HISTORY);
  };

  const handleSendClicked = () => {
    const text = (composeText || '').trim();
    if (text.length) {
      setComposeText('');
      sendMessage(text);
      appendMessageToHistory(text);
    }
  };

  const handleRecordButtonClicked = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
    } catch (error) {
      console.error('访问权限被拒绝或发生其他错误:', error);
    }
  };

  const handleRecordClose = (param: string) => {
    setIsRecording(false);
    setComposeText(param);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!disableSend) handleSendClicked();
      e.preventDefault();
    }
  };

  const pasteFromHistory = (text: string) => {
    setComposeText(text);
    hideHistory();
  };

  const showHistory = (event: React.MouseEvent<HTMLAnchorElement>) => setHistoryAnchor(event.currentTarget);

  const hideHistory = () => setHistoryAnchor(null);

  const textPlaceholder: string = '请输入提示词...';

  return (
    <Grid container spacing={{ xs: 1, md: 2 }}>
      <Grid xs={12} md={9}>
        <Stack direction="row" spacing={{ xs: 1, md: 2 }}>
          {/* 输入框 */}
          <Box sx={{ flexGrow: 1, position: 'relative' }}>
            <Textarea
              variant="soft"
              autoFocus
              placeholder={textPlaceholder}
              minRows={5}
              maxRows={12}
              onKeyDown={handleKeyPress}
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              sx={{ fontSize: '16px', lineHeight: 1.75 }}
            />
          </Box>
        </Stack>
      </Grid>

      {/* 辅助功能按钮 */}
      <Grid xs={12} md={3}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <Button fullWidth variant="solid" color="primary" disabled={disableSend} onClick={handleSendClicked} endDecorator={<TelegramIcon />}>
              文本发送
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <Button fullWidth variant="soft" color="primary" disabled={disableSend} onClick={handleRecordButtonClicked} endDecorator={<MicIcon />}>
              语音发送
            </Button>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'row' }}>
            <Button fullWidth variant="plain" color="neutral" onClick={showHistory} endDecorator={<HistoryIcon />}>
              历史记录
            </Button>
          </Box>
        </Stack>
      </Grid>

      {/* 历史消息记录（仅在显示时） */}
      {!!historyAnchor && (
        <Menu size="md" anchorEl={historyAnchor} open onClose={hideHistory} sx={{ minWidth: 320 }}>
          <MenuItem color="neutral" selected>
            复用消息 💬
          </MenuItem>
          <ListDivider />
          {messages.map((text, index) => (
            <MenuItem key={'compose-history-' + index} onClick={() => pasteFromHistory(text)}>
              {text.length > 60 ? text.slice(0, 58) + '...' : text}
            </MenuItem>
          ))}
          <ListDivider />
          <MenuItem>
            <DeleteIcon onClick={clearMessageHistory} />
          </MenuItem>
        </Menu>
      )}

      {/* 弹框-录音动画 */}
      <Voice open={isRecording} onClose={(param) => handleRecordClose(param)} />
    </Grid>
  );
}
