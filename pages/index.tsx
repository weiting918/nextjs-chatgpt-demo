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

/// 内置提示词

type SystemPurpose = 'Catalyst' | 'Custom' | 'Developer' | 'Executive' | 'Generic' | 'Scientist';

const PurposeData: { [key in SystemPurpose]: { systemMessage: string; description: string | JSX.Element } } = {
  Catalyst: {
    systemMessage:
      'You are a marketing extraordinaire for a booming startup fusing creativity, data-smarts, and digital prowess to skyrocket growth & wow audiences. So fun. Much meme. 🚀🎯💡',
    description: 'The growth hacker with marketing superpowers 🚀',
  },
  Custom: {
    systemMessage:
      'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.\nKnowledge cutoff: 2021-09\nCurrent date: {{Today}}',
    description: 'User-defined purpose',
  },
  Developer: {
    systemMessage: 'You are a sophisticated, accurate, and modern AI programming assistant',
    description: <>Helps you code</>,
  },
  Executive: {
    systemMessage: 'You are an executive assistant. Your communication style is concise, brief, formal',
    description: 'Helps you write business emails',
  },
  Generic: {
    systemMessage:
      'You are ChatGPT, a large language model trained by OpenAI, based on the GPT-4 architecture.\nKnowledge cutoff: 2021-09\nCurrent date: {{Today}}',
    description: 'Helps you think',
  },
  Scientist: {
    systemMessage:
      "You are a scientist's assistant. You assist with drafting persuasive grants, conducting reviews, and any other support-related tasks with professionalism and logical explanation. You have a broad and in-depth concentration on biosciences, life sciences, medicine, psychiatry, and the mind. Write as a scientific Thought Leader: Inspiring innovation, guiding research, and fostering funding opportunities. Focus on evidence-based information, emphasize data analysis, and promote curiosity and open-mindedness",
    description: 'Helps you write scientific papers',
  },
};

/// 聊天消息类型和创建新消息的辅助函数

const MessageDefaults: { [key in UiMessage['role']]: Pick<UiMessage, 'role' | 'sender' | 'avatar'> } = {
  system: {
    role: 'system',
    sender: 'Bot',
    avatar: SmartToyTwoToneIcon, //'https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png',
  },
  user: {
    role: 'user',
    sender: 'You',
    avatar: Face6Icon, //https://mui.com/static/images/avatar/2.jpg',
  },
  assistant: {
    role: 'assistant',
    sender: 'Bot',
    avatar: SmartToyOutlinedIcon, // 'https://www.svgrepo.com/show/306500/openai.svg',
  },
};

const createUiMessage = (role: UiMessage['role'], text: string): UiMessage => ({
  uid: Math.random().toString(36).substring(2, 15),
  text: text,
  model: '',
  ...MessageDefaults[role],
});

/// 主界面 ///

export default function Conversation() {
  const theme = useTheme();
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const [selectedSystemPurpose, setSelectedSystemPurpose] = React.useState<SystemPurpose>('Developer');
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [disableCompose, setDisableCompose] = React.useState(false);
  const [settingsShown, setSettingsShown] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);


  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  React.useEffect(() => {
    // show the settings at startup if the API key is not present
    if (!isValidOpenAIApiKey(loadOpenAIApiKey())) setSettingsShown(true);
  }, []);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleListClear = () => setMessages([]);

  const handleListDelete = (uid: string) => setMessages((list) => list.filter((message) => message.uid !== uid));

  const handleListEdit = (uid: string, newText: string) =>
    setMessages((list) => list.map((message) => (message.uid === uid ? { ...message, text: newText } : message)));

  const handleListRunAgain = (uid: string) => {
    // take all messages until we get to uid, then remove the rest
    const uidPosition = messages.findIndex((message) => message.uid === uid);
    if (uidPosition === -1) return;
    const conversation = messages.slice(0, uidPosition + 1);
    setMessages(conversation);

    // disable the composer while the bot is replying
    setDisableCompose(true);
    getBotMessageStreaming(conversation).then(() => setDisableCompose(false));
  };

  const handlePurposeChange = (purpose: SystemPurpose | null) => {
    if (!purpose) return;

    if (purpose === 'Custom') {
      const systemMessage = prompt('Enter your custom AI purpose', PurposeData['Custom'].systemMessage);
      PurposeData['Custom'].systemMessage = systemMessage || '';
    }

    setSelectedSystemPurpose(purpose);
  };

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

        // there may be a JSON object at the beginning of the message, which contains the model name (streaming workaround)
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
          // if missing, add the message at the end of the list, otherwise set a new list anyway, to trigger a re-render
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

  const Emoji = (props: any) => null;

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
                <Typography level="body3" color="neutral">
                  AI purpose
                </Typography>
                <Select value={selectedSystemPurpose} onChange={(e, v) => handlePurposeChange(v)} sx={{ minWidth: '40vw' }}>
                  <Option value="Developer">
                    <Emoji>👩‍💻</Emoji> Developer
                  </Option>
                  <Option value="Scientist">
                    <Emoji>🔬</Emoji> Scientist
                  </Option>
                  <Option value="Executive">
                    <Emoji>👔</Emoji> Executive
                  </Option>
                  <Option value="Catalyst">
                    <Emoji>🚀</Emoji> Catalyst
                  </Option>
                  <Option value="Generic">
                    <Emoji>🧠</Emoji> ChatGPT4
                  </Option>
                  <Option value="Custom">
                    <Emoji>✨</Emoji> Custom
                  </Option>
                </Select>
                <Typography level="body2" sx={{ mt: 2, minWidth: 260 }}>
                  {PurposeData[selectedSystemPurpose].description}
                </Typography>
              </Box>
            </Stack>
          ) : (
            <>
              <List sx={{ p: 0 }}>
                {messages.map((message, index) => (
                  <ChatMessage
                    key={'msg-' + message.uid}
                    uiMessage={message}
                    onDelete={() => handleListDelete(message.uid)}
                    onEdit={(newText) => handleListEdit(message.uid, newText)}
                    onRunAgain={() => handleListRunAgain(message.uid)}
                  />
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
