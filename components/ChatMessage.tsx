import * as React from 'react';
import { Sandpack } from '@codesandbox/sandpack-react';

import Prism from 'prismjs';
import 'prismjs/themes/prism.css';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-java';

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StopOutlinedIcon from '@mui/icons-material/StopOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SportsMartialArtsOutlinedIcon from '@mui/icons-material/SportsMartialArtsOutlined';

import { Avatar, Box, Button, IconButton, ListItem, Stack, Tooltip, Typography, useTheme } from '@mui/joy';
import { SxProps, Theme } from '@mui/joy/styles/types';

export interface UiMessage {
  uid: string;
  sender: 'You' | 'Bot' | string;
  role: 'assistant' | 'system' | 'user';
  text: string;
  model: string;
  avatar: string | React.ElementType | null;
}

/// 消息拆分为文本和代码块的实用工具

type MessageBlock = { type: 'text'; content: string } | CodeMessageBlock;
type CodeMessageBlock = { type: 'code'; content: string; code: string; language: string };

const parseAndHighlightCodeBlocks = (text: string): MessageBlock[] => {
  const codeBlockRegex = /`{3,}(\w+)?\n([\s\S]*?)(`{3,}|$)/g;
  const result: MessageBlock[] = [];

  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'typescript';
    const codeBlock = match[2].trim();

    const highlightedCode = Prism.highlight(codeBlock, Prism.languages[language] || Prism.languages.typescript, language);
    result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    result.push({ type: 'code', content: highlightedCode, code: codeBlock, language });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return result;
};

const copyToClipboard = (text: string) => {
  if (typeof navigator !== 'undefined')
    navigator.clipboard
      .writeText(text)
      .then(() => console.log('Message copied to clipboard'))
      .catch((err) => console.error('Failed to copy message: ', err));
};

/// 不同类型的消息组件

type SandpackConfig = { template: 'vanilla-ts' | 'vanilla'; files: Record<string, string> };

function RunnableCode({ codeBlock, theme }: { codeBlock: CodeMessageBlock; theme: Theme }): JSX.Element | null {
  let config: SandpackConfig;
  switch (codeBlock.language) {
    case 'typescript':
    case 'javascript':
      config = {
        template: 'vanilla-ts',
        files: { '/index.ts': codeBlock.code },
      };
      break;
    case 'html':
      config = {
        template: 'vanilla',
        files: { '/index.html': codeBlock.code },
      };
      break;
    default:
      return null;
  }
  return (
    <Sandpack
      {...config}
      theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
      options={{ showConsole: true, showConsoleButton: true, showTabs: false, showNavigator: false }}
    />
  );
}

function ChatMessageCodeBlock({ codeBlock, theme, sx }: { codeBlock: CodeMessageBlock; theme: Theme; sx?: SxProps }) {
  const [showSandpack, setShowSandpack] = React.useState(false);

  const handleCopyToClipboard = () => copyToClipboard(codeBlock.code);

  const handleToggleSandpack = () => setShowSandpack(!showSandpack);

  return (
    <Box
      component="code"
      sx={{
        position: 'relative',
        ...(sx || {}),
        mx: 0,
        p: 1.5,
        display: 'block',
        fontWeight: 500,
        background: theme.vars.palette.background.level1,
        '&:hover > button': { opacity: 1 },
      }}
    >
      <IconButton
        variant="plain"
        color="primary"
        onClick={handleCopyToClipboard}
        sx={{ position: 'absolute', top: 0, right: 0, zIndex: 10, p: 0.5, opacity: 0, transition: 'opacity 0.3s' }}
      >
        <ContentCopyIcon />
      </IconButton>
      <IconButton
        variant="plain"
        color="primary"
        onClick={handleToggleSandpack}
        sx={{ position: 'absolute', top: 0, right: 50, zIndex: 10, p: 0.5, opacity: 0, transition: 'opacity 0.3s' }}
      >
        {showSandpack ? <StopOutlinedIcon /> : <PlayArrowOutlinedIcon />}
      </IconButton>
      <Box dangerouslySetInnerHTML={{ __html: codeBlock.content }} />
      {showSandpack && <RunnableCode codeBlock={codeBlock} theme={theme} />}
    </Box>
  );
}

function prettyModel(model: string): string {
  if (model.startsWith('gpt-4')) return 'gpt-4';
  if (model.startsWith('gpt-3.5-turbo')) return '3.5-turbo';
  return model;
}

/**
 * 聊天消息UI组件
 * 支持不同的角色，用户、机器人、系统
 * 支持代码语法高亮
 * 支持沙箱在线编辑和运行代码
 * 支持复制代码到剪贴板
 * 支持展开代码块
 *
 * @param {UiMessage} props.uiMessage - 消息数据
 */
export function ChatMessage(props: { uiMessage: UiMessage }) {
  const theme = useTheme();
  const message = props.uiMessage;

  const [forceExpanded, setForceExpanded] = React.useState(false);

  const handleExpand = () => setForceExpanded(true);

  // 主题配置
  let background = theme.vars.palette.background.body;
  let textBackground: string | undefined = undefined;
  if (message.role === 'system') {
    background = theme.vars.palette.background.body;
    textBackground = theme.vars.palette.primary.plainHoverBg;
  } else if (message.sender === 'You') {
    background = theme.vars.palette.primary.plainHoverBg;
  } else if (message.role === 'assistant') {
    if (message.text.startsWith('Error: ') || message.text.startsWith('OpenAI API error: ')) {
      background = theme.vars.palette.danger.softBg;
    } else background = theme.vars.palette.background.body;
  }

  // 文本框样式
  const chatFontCss = {
    my: 'auto',
    fontFamily: message.role === 'assistant' ? theme.fontFamily.code : undefined,
    fontSize: message.role === 'assistant' ? '14px' : '16px',
    lineHeight: 1.75,
  };

  // 用户消息截断
  let collapsedText = message.text;
  let isCollapsed = false;
  if (!forceExpanded && message.role === 'user') {
    const lines = message.text.split('\n');
    if (lines.length > 10) {
      collapsedText = lines.slice(0, 10).join('\n');
      isCollapsed = true;
    }
  }

  return (
    <ListItem
      sx={{
        display: 'flex',
        flexDirection: message.sender === 'You' ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        px: 1,
        py: 2,
        background,
        borderBottom: '1px solid',
        borderBottomColor: `rgba(${theme.vars.palette.neutral.mainChannel} / 0.1)`,
      }}
    >
      <Stack sx={{ alignItems: 'center', minWidth: 64, textAlign: 'center' }}>
        {typeof message.avatar === 'string' ? (
          <Avatar alt={message.sender} src={message.avatar} />
        ) : message.avatar != null ? (
          <message.avatar sx={{ width: 40, height: 40 }} />
        ) : (
          <SportsMartialArtsOutlinedIcon sx={{ width: 40, height: 40 }} />
        )}

        {message.role === 'system' && (
          <Typography level="body2" color="neutral">
            system
          </Typography>
        )}
        {message.role === 'assistant' && (
          <Tooltip title={message.model} variant="solid">
            <Typography level="body2" color="neutral">
              {prettyModel(message.model)}
            </Typography>
          </Tooltip>
        )}
      </Stack>

      {
        <Box sx={{ ...chatFontCss, flexGrow: 0, whiteSpace: 'break-spaces' }}>
          {parseAndHighlightCodeBlocks(collapsedText).map((part, index) =>
            part.type === 'code' ? (
              <ChatMessageCodeBlock key={index} codeBlock={part} theme={theme} sx={chatFontCss} />
            ) : (
              <Typography key={index} level="body1" component="span" sx={{ ...chatFontCss, mx: 1.5, background: textBackground }}>
                {part.content}
              </Typography>
            ),
          )}
          {isCollapsed && (
            <Button variant="plain" onClick={handleExpand}>
              ... 展开 ...
            </Button>
          )}
        </Box>
      }
    </ListItem>
  );
}
