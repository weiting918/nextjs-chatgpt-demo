import Head from 'next/head';
import createCache from '@emotion/cache';
import { AppProps } from 'next/app';
import { CacheProvider, EmotionCache } from '@emotion/react';
import { CssBaseline, CssVarsProvider, extendTheme } from '@mui/joy';
import { Inter, JetBrains_Mono } from 'next/font/google';


// 主题 & 字体

const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

const jetBrainsMono = JetBrains_Mono({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  fallback: ['monospace'],
});

export const theme = extendTheme({
  fontFamily: {
    body: inter.style.fontFamily,
    code: jetBrainsMono.style.fontFamily,
  },
});

export const bodyFontClassName = inter.className;


// 客户端缓存, 在浏览器中为用户的整个会话共享.

const isBrowser = typeof document !== 'undefined';

export function createEmotionCache() {
  let insertionPoint;

  if (isBrowser) {
    // 查找名为 “emotion-insertion-point” 的 meta 标签.
    // 将其作为样式插入点，确保 mui 样式优先加载，允许开发人员轻松地使用其他解决方案（如 CSS 模块）覆盖 MUI 样式.
    const emotionInsertionPoint = document.querySelector<HTMLMetaElement>(
      'meta[name="emotion-insertion-point"]',
    );
    insertionPoint = emotionInsertionPoint ?? undefined;
  }

  return createCache({ key: 'mui-style', insertionPoint });
}

const clientSideEmotionCache = createEmotionCache();


export interface MyAppProps extends AppProps {
  emotionCache?: EmotionCache;
}

export default function MyApp({ Component, emotionCache = clientSideEmotionCache, pageProps }: MyAppProps) {
  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <meta name='viewport' content='initial-scale=1, width=device-width' />
      </Head>
      <CssVarsProvider defaultMode='light' theme={theme}>
        {/* CssBaseline 是一个用于初始化样式的组件，提供了一个优雅、一致且简单的基线样式。*/}
        <CssBaseline />
        <Component {...pageProps} />
      </CssVarsProvider>
    </CacheProvider>
  );
}