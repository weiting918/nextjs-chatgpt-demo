import * as React from 'react';
import { Box, Button, Input, Modal, ModalClose, ModalDialog, Option, Select, Typography } from '@mui/joy';


/// 浏览器存储: API Key 和 gpt model

const LOCALSTORAGE_KEY_OPENAI_API_KEY = 'app-settings-openai-api-key';

const LOCALSTORAGE_KEY_GPT_MODEL = 'app-settings-openai-gpt-model';

export const loadOpenAIApiKey = (): string => {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(LOCALSTORAGE_KEY_OPENAI_API_KEY) || '';
};

export const loadGptModel = (fallback: string = 'gpt-4'): string => {
  if (typeof localStorage === 'undefined') return fallback;
  return localStorage.getItem(LOCALSTORAGE_KEY_GPT_MODEL) || fallback;
};

const storeOpenAIApiKey = (apiKey: string) => {
  if (typeof localStorage === 'undefined') return;
  if (apiKey) localStorage.setItem(LOCALSTORAGE_KEY_OPENAI_API_KEY, apiKey);
  else localStorage.removeItem(LOCALSTORAGE_KEY_OPENAI_API_KEY);
};

const storeGptModel = (gptModel: string) => {
  if (typeof localStorage === 'undefined') return;
  if (gptModel) localStorage.setItem(LOCALSTORAGE_KEY_GPT_MODEL, gptModel);
  else localStorage.removeItem(LOCALSTORAGE_KEY_GPT_MODEL);
};

export const isValidOpenAIApiKey = (apiKey?: string) =>
  apiKey && apiKey.startsWith('sk-') && apiKey.length > 40;


/**
 * 组件允许用户修改应用程序设置,
 * 设置会通过 localStorage 在浏览器进行持久化.
 *
 * @param {boolean} open 是否打开设置对话框
 * @param {() => void} onClose 外部调用此函数以关闭对话框
 */
export function Settings({ open, onClose }: { open: boolean, onClose: () => void; }) {
  const [apiKey, setApiKey] = React.useState<string>(loadOpenAIApiKey());
  const [gptModel, setGptModel] = React.useState<string>(loadGptModel());

  const handleApiKeyChange = (e: React.ChangeEvent) =>
    setApiKey((e.target as HTMLInputElement).value);

  const handleGptModelChange = (e: React.FocusEvent | React.MouseEvent | React.KeyboardEvent | null, value: string | null) =>
    setGptModel(value ? value : 'gpt-4');

  const handleApiKeyDown = (e: React.KeyboardEvent) =>
    (e.key === 'Enter') && handleSaveClicked();

  const handleSaveClicked = () => {
    storeOpenAIApiKey(apiKey);
    storeGptModel(gptModel);
    onClose();
  };

  const isValidKey = isValidOpenAIApiKey(apiKey);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog sx={{ minWidth: '40vw' }}>
        <ModalClose />
        <Typography level='h5'>Settings</Typography>

        <Box sx={{ mt: 3, minWidth: 300 }}>

          <Typography sx={{ mb: 1 }}>
            输入 OpenAI API Key
          </Typography>

          <Input variant='outlined' placeholder={'sk-...'} error={!isValidKey}
                 value={apiKey} onChange={handleApiKeyChange} onKeyDown={handleApiKeyDown} />

          <Typography sx={{ mt: 3, mb: 1 }}>
            选择大语言模型
          </Typography>

          <Select
            variant='outlined'
            value={gptModel}
            onChange={handleGptModelChange}
          >
            <Option value={'gpt-4'}>GPT-4</Option>
            <Option value={'gpt-3.5-turbo'}>GPT-3.5 Turbo</Option>
          </Select>

          <Button variant='solid' disabled={!isValidKey} color={isValidKey ? 'primary' : 'neutral'} sx={{ mt: 3 }} onClick={handleSaveClicked}>
            保存
          </Button>

        </Box>

      </ModalDialog>
    </Modal>
  );
}