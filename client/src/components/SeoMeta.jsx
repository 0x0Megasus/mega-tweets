import { Helmet } from "react-helmet-async";

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://mega-novels-zhuu.vercel.app";

const toAbsoluteUrl = (value = "") => {
  if (!value) return SITE_URL;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
};

export default function SeoMeta({
  title = "Mega Tweets",
  description = "Share tweets, chat in groups and DMs, and follow people on Mega Tweets.",
  robots = "index,follow",
  ogImage = "/app-icon-512.png",
  path = "/",
}) {
  const absolutePath = path.startsWith("/") ? path : `/${path}`;
  const canonicalUrl = `${SITE_URL}${absolutePath}`;
  const imageUrl = toAbsoluteUrl(ogImage);

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <link rel="canonical" href={canonicalUrl} />
    </Helmet>
  );
}
