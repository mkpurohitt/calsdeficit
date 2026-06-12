"use client";
// Loads Google CMP (Funding Choices) for EEA/UK consent, then AdSense.
// Both load lazily after hydration and only when a publisher ID is set.
import Script from "next/script";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export default function ConsentManager() {
  if (!ADSENSE_CLIENT) return null;
  const publisherId = ADSENSE_CLIENT.replace(/^ca-/, "");

  return (
    <>
      {/* Google Funding Choices CMP (configure the message in AdSense → Privacy & messaging) */}
      <Script
        id="google-cmp"
        src={`https://fundingchoicesmessages.google.com/i/${publisherId}?ers=1`}
        strategy="lazyOnload"
      />
      <Script id="google-cmp-present" strategy="lazyOnload">
        {`(function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){const iframe=document.createElement('iframe');iframe.style.cssText='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;';iframe.name='googlefcPresent';document.body.appendChild(iframe);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();`}
      </Script>
      <Script
        id="adsense"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
    </>
  );
}
