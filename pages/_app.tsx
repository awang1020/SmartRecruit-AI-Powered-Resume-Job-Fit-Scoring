import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>SmartRecruit Fit Analyzer</title>
        <meta
          name="description"
          content="Analyze resume and job description fit using Azure OpenAI."
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
