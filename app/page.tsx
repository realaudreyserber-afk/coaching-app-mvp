import { redirect } from "next/navigation";

function isConfigured(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  return Boolean(apiKey && apiKey.length > 0 && !apiKey.startsWith('mock-'));
}

export default function Home() {
  if (!isConfigured()) {
    redirect('/setup');
  }
  redirect('/dashboard');
}
