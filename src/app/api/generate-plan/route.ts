import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getHistory, savePlan } from '@/utils/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { feeling, rhr, bodyBattery } = body;

    const garminData = {
      rhr: rhr || 50,
      bodyBattery: bodyBattery || 80,
      stress: 20,
      sleep: 8.0,
    };
    
    // Fetch real history for context
    const history = await getHistory();

    const apiKey = process.env.GEMINI_API_KEY || 'mock-key-for-dev';
    
    // Pro vývoj bez API klíče vracíme statický mock podle pocitu
    if (apiKey === 'mock-key-for-dev') {
      const mockResponse = feeling === 'Skvěle' 
        ? "### STATUS\nZelený den pro růst! Tělo je plně regenerované a připravené na výkon.\n\n### DOPORUČENÍ\n* **Kolo:** NE\n* **Běh:** ANO\n* **Cvičení:** ANO (ZAMĚŘENÍ: Core po běhu)\n\n### TRÉNINKOVÝ PLÁN\nDnes naplánujeme progresivní běh, protože jsi tento týden ještě neběžel. 45 minut v Zóně 2, posledních 10 minut zrychli do Zóny 3. Poté 15 minut stabilizace core.\n\n### FOCUS & VAROVÁNÍ\nZaměř se na kadenci kroků, nepřetěžuj kolena a ihned po tréninku doplň sacharidy s proteiny."
        : feeling === 'Cítím zánět'
        ? "### STATUS\nČervený den (Stopka). Tělo bojuje se zánětem, je nutné podpořit imunitu a neriskovat.\n\n### DOPORUČENÍ\n* **Kolo:** NE\n* **Běh:** NE\n* **Cvičení:** POUZE LEHCE (ZAMĚŘENÍ: Stretching)\n\n### TRÉNINKOVÝ PLÁN\nStriktní odpočinek. Dnes maximálně 10-15 minut velmi lehkého protažení na podložce bez jakéhokoliv pocení.\n\n### FOCUS & VAROVÁNÍ\nHlídej si pitný režim a zvaž zvýšení příjmu protizánětlivých suplementů (omega-3, kurkumin)."
        : "### STATUS\nŽlutý den. Tělo je v neutrálním stavu, udržujeme aktivní regeneraci bez rázové zátěže.\n\n### DOPORUČENÍ\n* **Kolo:** ANO (POUZE LEHCE)\n* **Běh:** NE\n* **Cvičení:** ANO (ZAMĚŘENÍ: Mobilita)\n\n### TRÉNINKOVÝ PLÁN\nBěh má dnes stopku kvůli nárazům. Vyraž na lehkou jízdu na kole (max 45 minut po rovině v čisté zóně 1-2). Alternativou je 30 minut cvičení na mobilitu.\n\n### FOCUS & VAROVÁNÍ\nDrž tepovku pod kontrolou, jakmile ucítíš těžké nohy, uber zátěž.";
      
      // Simulace zpoždění sítě
      await new Promise(r => setTimeout(r, 1500));
      return NextResponse.json({ plan: mockResponse });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
Jsi elitní sportovní fyziolog, osobní AI trenér a specialista na řízení tréninkové zátěže u sportovců s chronickými zánětlivými procesy. Tvojí úlohou je analyzovat ranní fyziologická data a navrhnout denní tréninkový plán na míru pro mobilní aplikaci.

PROFIL KLIENTA: Muž, 183 cm, 80 kg. Cíle: Běh (2x týdně), Kolo (1x týdně), Cvičení. Trpí chronickým zánětem (flare-ups).

TVÁ FILOZOFIE:
1. Ochrana imunity a prevence přetrénování.
2. Progresivní rozvoj (Superkompenzace) pouze při Zelených dnech.

VSTUPNÍ DATA DNES:
- Garmin: RHR ${garminData.rhr}, Body Battery ${garminData.bodyBattery}, Stres ${garminData.stress}, Spánek ${garminData.sleep}h.
- Subjektivní pocit: ${feeling}
- Historie posledních dní: ${JSON.stringify(history)}

ROZHODOVACÍ STROM:
FÁZE A: ČERVENÉ DNY (Zánět / Vysoké RHR / Nízké BB). STRIKTNÍ ODPOČINEK.
FÁZE B: ŽLUTÉ DNY (Neutrálně / BB 40-75). AKTIVNÍ REGENERACE (Kolo/Mobilita), Zákaz běhu.
FÁZE C: ZELENÉ DNY (Cítí se skvěle / BB > 75). STIMULACE K RŮSTU. Dnes klienta posouváš!

VÝSTUPNÍ FORMÁT (dodržuj striktně markdown strukturu přesně podle těchto nadpisů):
### STATUS
### DOPORUČENÍ
### TRÉNINKOVÝ PLÁN
### FOCUS & VAROVÁNÍ
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });
    const planText = response.text || '';

    // Save the newly generated plan to Supabase
    try {
      await savePlan({
        date: new Date().toISOString().split('T')[0],
        feeling: feeling,
        activity: `RHR: ${garminData.rhr}, BB: ${garminData.bodyBattery}`,
        ai_recommendation: planText
      });
    } catch (saveErr) {
      console.error("Uložení do historie selhalo:", saveErr);
      // We don't throw here so the user still gets the plan even if save fails
    }

    return NextResponse.json({ plan: planText });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate plan' }, { status: 500 });
  }
}
