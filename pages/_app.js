import "../styles/globals.css";
import { useRouter } from "next/router";
import WhatsAppButton from "../components/WhatsAppButton";

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isAdmin = router.pathname.startsWith("/admin");
  return (
    <>
      <Component {...pageProps} />
      {!isAdmin && <WhatsAppButton />}
    </>
  );
}
