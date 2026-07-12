import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getHistory, savePlan } from '@/utils/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { feeling, rhr, bodyBattery, sleep, yesterdayActivity } = body;

    const garminData = {
      rhr: rhr || 50,
      bodyBattery: bodyBattery || 80,
      sleep: sleep || 8.0,
    };
    
    // Whoop-like Recovery Calculation (0-100)
    // Váhy: Body Battery (60%), Sleep (40%)
    let sleepScore = Math.min((garminData.sleep / 8) * 100, 100);
    let recoveryScore = Math.round((garminData.bodyBattery * 0.6) + (sleepScore * 0.4));
    if (recoveryScore > 100) recoveryScore = 100;

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
Jsi elitní sportovní fyziolog a osobní "Whoop Coach" pro sportovce s chronickými zánětlivými procesy.
Analyzuj dnešní fyziologická data a navrhni denní plán.

PROFIL: Muž, 183 cm, 80 kg. Cíle: Běh (2x týdně), Kolo (1x týdně), Cvičení. Náchylný na záněty.
FILOZOFIE:
1. Ochrana imunity a prevence přetrénování.
2. Progresivní rozvoj (Superkompenzace) pouze při Zelených dnech (Recovery > 66%).

DNESNÍ DATA:
- Včerejší reálná aktivita: ${yesterdayActivity}
- Whoop Recovery Score: ${recoveryScore}%
- RHR: ${garminData.rhr} bpm
- Body Battery: ${garminData.bodyBattery}
- Spánek: ${garminData.sleep}h
- Subjektivní pocit: ${feeling}
- Historie (posledních pár dní): ${JSON.stringify(history)}

ROZHODOVACÍ STROM (Podle Recovery Score):
- ČERVENÝ DEN (0-35% nebo Zánět nebo Velká únava): STRIKTNÍ ODPOČINEK. Ani stretching. Jen spánek a kvalitní strava. ZÁKAZ JAKÉKOLIV AKTIVITY.
- ŽLUTÝ DEN (36-70%): LEHKÁ REGENERACE. Povolena pouze lehká procházka (max 30 min) nebo domácí protažení na podložce. PŘÍSNÝ ZÁKAZ BĚHU I KOLA.
- ZELENÝ DEN (71-100%): TRÉNINK. Tělo je připraveno na zátěž. Můžeš zařadit Běh, Kolo nebo Cvičení, vždy ale zohledni, co sportovec dělal včera.

VÝSTUP (Markdown, formátuj jako AI kouč):
### STATUS
### DOPORUČENÍ
### TRÉNINKOVÝ PLÁN
### FOCUS & VAROVÁNÍ
`;

    const modelsToTry = ['gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let planText = '';
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying model: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        if (response.text) {
          planText = response.text;
          break; // Úspěšně vygenerováno
        }
      } catch (e: any) {
        console.warn(`Model ${modelName} failed:`, e.message);
        // Pokud je to poslední model v poli, vyhodíme chybu
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw e;
        }
      }
    }

    if (!planText) {
      throw new Error("Nepodařilo se vygenerovat plán ze žádného dostupného modelu.");
    }

    // Save the newly generated plan to Supabase
    try {
      await savePlan({
        date: new Date().toISOString().split('T')[0],
        feeling: feeling,
        activity: `[Včera: ${yesterdayActivity}] Recovery: ${recoveryScore}% | RHR: ${garminData.rhr} | BB: ${garminData.bodyBattery} | Spánek: ${garminData.sleep}h`,
        ai_recommendation: planText
      });
    } catch (saveErr) {
      console.error("Uložení do historie selhalo:", saveErr);
    }

    return NextResponse.json({ plan: planText, recoveryScore });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate plan' }, { status: 500 });
  }
}
