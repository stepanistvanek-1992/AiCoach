import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const correctPassword = process.env.APP_PASSWORD;

    if (!correctPassword) {
      console.warn("Není nastaveno APP_PASSWORD v proměnných prostředí.");
      return NextResponse.json({ error: "Server není správně nakonfigurován (chybí heslo)." }, { status: 500 });
    }

    if (password === correctPassword) {
      // Vytvoření odpovědi a nastavení cookies na 1 rok
      const response = NextResponse.json({ success: true });
      response.cookies.set({
        name: 'ai_coach_auth',
        value: 'authenticated',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 rok
        path: '/',
      });
      return response;
    } else {
      return NextResponse.json({ error: "Nesprávné heslo." }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json({ error: "Chyba při přihlašování." }, { status: 500 });
  }
}
