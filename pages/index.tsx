import * as React from 'react';

import { Box, Container, IconButton, List, Option, Select, Sheet, Stack, Typography, useColorScheme, useTheme } from '@mui/joy';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import Face6Icon from '@mui/icons-material/Face6';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SmartToyTwoToneIcon from '@mui/icons-material/SmartToyTwoTone';
import RefreshIcon from '@mui/icons-material/Refresh';

import { ChatMessage, UiMessage } from '../components/ChatMessage';
import { Composer } from '../components/Composer';
import { isValidOpenAIApiKey, loadGptModel, loadOpenAIApiKey, Settings } from '../components/Settings';

/// 聊天消息类型和创建新消息的辅助函数

const MessageDefaults: { [key in UiMessage['role']]: Pick<UiMessage, 'role' | 'sender' | 'avatar'> } = {
  system: {
    role: 'system',
    sender: 'Bot',
    avatar: SmartToyTwoToneIcon,
  },
  user: {
    role: 'user',
    sender: 'You',
    avatar: Face6Icon,
  },
  assistant: {
    role: 'assistant',
    sender: 'Bot',
    avatar: SmartToyOutlinedIcon,
  },
};

const createUiMessage = (role: UiMessage['role'], text: string): UiMessage => ({
  uid: Math.random().toString(36).substring(2, 15),
  text: text,
  model: '',
  ...MessageDefaults[role],
});

/// 主界面

export default function Conversation() {
  const theme = useTheme();
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [disableCompose, setDisableCompose] = React.useState(false);
  const [settingsShown, setSettingsShown] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    // 在启动时检查API密钥是否存在，如果不存在，则显示设置
    if (!isValidOpenAIApiKey(loadOpenAIApiKey())) setSettingsShown(true);
  }, []);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleListClear = () => setMessages([]);

  const getBotMessageStreaming = async (messages: UiMessage[]) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: loadOpenAIApiKey(), model: loadGptModel(), messages: messages }),
    });

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      const newBotMessage: UiMessage = createUiMessage('assistant', '');

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const messageText = decoder.decode(value);
        newBotMessage.text += messageText;

        // 消息开头可能有一个json对象, 其中包含模型名称 (流式处理方法)
        if (!newBotMessage.model && newBotMessage.text.startsWith('{')) {
          const endOfJson = newBotMessage.text.indexOf('}');
          if (endOfJson > 0) {
            const json = newBotMessage.text.substring(0, endOfJson + 1);
            try {
              const parsed = JSON.parse(json);
              newBotMessage.model = parsed.model;
              newBotMessage.text = newBotMessage.text.substring(endOfJson + 1);
            } catch (e) {
              // error parsing JSON, ignore
              console.log('Error parsing JSON: ' + e);
            }
          }
        }

        setMessages((list) => {
          const message = list.find((message) => message.uid === newBotMessage.uid);
          return !message ? [...list, newBotMessage] : [...list];
        });
      }
    }
  };

  const handleComposerSendMessage: (text: string) => void = (text) => {
    const conversation = [...messages];

    // 添加用户消息，传达用户的意图
    conversation.push(createUiMessage('user', text));

    // 更新 message 状态为新的 conversation
    setMessages(conversation);

    // 禁止用户在机器人回复期间继续发送消息
    setDisableCompose(true);
    getBotMessageStreaming(conversation).then(() => setDisableCompose(false));
  };

  const listEmpty = !messages.length;

  return (
    <Container
      maxWidth="xl"
      disableGutters
      sx={{
        boxShadow: theme.vars.shadow.lg,
      }}
    >
      <Stack
        direction="column"
        sx={{
          minHeight: '100vh',
        }}
      >
        {/* 顶部导航栏 */}
        <Sheet
          variant="solid"
          invertedColors
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            p: 1,
            background: theme.vars.palette.primary.solidHoverBg,
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          <IconButton variant="plain" onClick={handleDarkModeToggle}>
            <DarkModeIcon />
          </IconButton>

          <Typography
            sx={{
              textAlign: 'center',
              fontFamily: theme.vars.fontFamily.code,
              fontSize: '1rem',
              lineHeight: 1.75,
              my: 'auto',
              flexGrow: 1,
            }}
            onDoubleClick={handleListClear}
          >
            React web chatgpt
          </Typography>

          <IconButton variant="plain" onClick={handleListClear}>
            <RefreshIcon />
          </IconButton>

          <IconButton variant="plain" onClick={() => setSettingsShown(true)}>
            <SettingsOutlinedIcon />
          </IconButton>
        </Sheet>

        {/* 聊天窗口 */}
        <Box
          sx={{
            flexGrow: 1,
            background: theme.vars.palette.background.level1,
          }}
        >
          {listEmpty ? (
            <Stack direction="column" sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
              <Box>
                <Typography level="body1" color="neutral">
                  请创建会话
                </Typography>
              </Box>
            </Stack>
          ) : (
            <>
              <List sx={{ p: 0 }}>
                {messages.map((message) => (
                  <ChatMessage key={'msg-' + message.uid} uiMessage={message} />
                ))}
                <div ref={messagesEndRef}></div>
              </List>
            </>
          )}
        </Box>

        {/* 用户输入窗口 */}
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            background: theme.vars.palette.background.body,
            borderTop: '1px solid',
            borderTopColor: theme.vars.palette.divider,
            p: { xs: 1, md: 2 },
          }}
        >
          <Composer disableSend={disableCompose} sendMessage={handleComposerSendMessage} />
        </Box>
      </Stack>

      {/* 弹框-设置项 */}
      <Settings open={settingsShown} onClose={() => setSettingsShown(false)} />
    </Container>
  );
}
