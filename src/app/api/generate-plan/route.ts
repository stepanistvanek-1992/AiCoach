import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getHistory, savePlan } from '@/utils/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { feeling, rhr, bodyBattery, sleep, yesterdayActivity } = body;

    const garminData = {
      rhr: parseInt(rhr) || 50,
      bodyBattery: parseInt(bodyBattery) || 80,
      sleep: parseFloat(sleep) || 8.0,
    };
    
    // WHOOP 3-Pillar Calculations
    // 1. Recovery Score (0-100%)
    let sleepRatio = Math.min(garminData.sleep / 8.0, 1.2);
    let sleepScore = sleepRatio * 100;
    
    // Impact of feeling on recovery
    let feelingPenalty = 0;
    if (feeling.includes('zánět') || feeling.includes('Vyčerpání')) {
      feelingPenalty = 35;
    } else if (feeling.includes('únava')) {
      feelingPenalty = 18;
    } else if (feeling.includes('Neutrální')) {
      feelingPenalty = 8;
    }

    let recoveryScore = Math.round((garminData.bodyBattery * 0.5) + (sleepScore * 0.3) + (20 - feelingPenalty));
    if (recoveryScore > 100) recoveryScore = 100;
    if (recoveryScore < 5) recoveryScore = 5;

    // 2. Strain Target (0-21)
    let targetStrain = 8.0;
    if (recoveryScore < 34) {
      targetStrain = 4.5; // Rest & Anti-inflammatory recovery day
    } else if (recoveryScore < 67) {
      targetStrain = 9.5; // Light activity / maintenance
    } else {
      targetStrain = 14.0; // Active growth day
    }

    // 3. Sleep Need (Hours)
    // Base 8h + strain factor + inflammation recovery buffer
    let sleepNeed = 8.0;
    if (recoveryScore < 34 || feelingPenalty >= 35) {
      sleepNeed += 1.2; // Extra sleep needed to fight inflammation
    } else if (recoveryScore < 67) {
      sleepNeed += 0.5;
    }
    sleepNeed = Math.round(sleepNeed * 10) / 10;

    // Fetch real history for context
    const history = await getHistory();

    const apiKey = process.env.GEMINI_API_KEY || 'mock-key-for-dev';
    
    // Pro vývoj bez API klíče vracíme lidský, protizánětlivý mock
    if (apiKey === 'mock-key-for-dev') {
      let mockResponse = '';
      if (recoveryScore < 34 || feeling.includes('zánět')) {
        mockResponse = `### 🌿 Zhodnocení stavu zánětu a regenerace\nTělo dnes signalizuje zvýšené zánětlivé zatížení a únavu. Vaše regenerace je na **${recoveryScore}%**, což znamená, že imunita potřebuje veškerou energii pro hojení a klid. Není kam spěchat – nespěchej a dej tělu čas.

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
Dnes vynechejte jakékoliv náročné tréninky, běh i silové cvičení. Ideální je **striktní odpočinek** nebo jen velmi lehká procházka na čerstvém vzduchu (max 15-20 minut pohodovým krokem bez pocení).

### 🛡️ Protizánětlivá péče & Výživa
* **Bylinkový čaj:** Připravte si teplý kurkumový nebo zázvorový čaj s citrónem.
* **Hydratace & Strava:** Doplňte dostatek čisté vody a vyhněte se průmyslově zpracovaným cukrům, které podporují zánět.
* **Relaxace:** Dopřejte si 10 minut vědomého dýchání nebo teplou sprchu před spaním.

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
Protože tělo bojuje se zánětem, vaše spánková potřeba pro dnešek je **${sleepNeed} hodin**. Zkuste jít spát o 45 minut dříve než obvykle a odložte telefon hodinu před spaním.`;
      } else if (recoveryScore < 67) {
        mockResponse = `### 🌿 Zhodnocení stavu zánětu a regenerace\nVaše regenerace je na **${recoveryScore}%** (Žlutá zóna). Tělo je v stabilním, udržovacím stavu bez akutního vzplanutí zánětu, ale stále vyžaduje rozumný přístup. 

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
Dnes je skvělý den pro **aktivní regeneraci a mobilitu**. Můžete zařadit lehkou procházku, nenáročné protažení na podložce nebo volnou jízdu na kole bez vysoké tepovky. Vyhněte se tréninku do vyčerpání.

### 🛡️ Protizánětlivá péče & Výživa
* **Omega-3 & Zdravé tuky:** Zařaďte do jídelníčku hrst vlašských ořechů, lněná semínka nebo rybu.
* **Jemná mobilita:** 15 minut lehkého uvolnění kyčlí a páteře pomůže lymfatickému systému odvádět toxiny.

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
Doporučená délka spánku pro dnešní noc je **${sleepNeed} hodin**. Udržujte pravidelný spánkový režim.`;
      } else {
        mockResponse = `### 🌿 Zhodnocení stavu zánětu a regenerace\nSkvělá zpráva! Vaše tělo je plně regenerované (Recovery **${recoveryScore}%**), imunita je stabilní a zánětlivé markery jsou pod kontrolou. Cítíte se připraveni na plný den.

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
Dnes má tělo zelenou pro **plnohodnotný trénink nebo aktivní den**. Můžete jít běhat, cvičit nebo na delší vyjížďku na kole. Stále si však všímejte signálů těla a nepřesahujte rozumnou hranici zátěže.

### 🛡️ Protizánětlivá péče & Výživa
* **Kvalitní doplňování paliva:** Nezapomeňte po tréninku doplnit sacharidy a kvalitní bílkoviny pro rychlou obnovu tkání.
* **Hořčík:** Večer zařaďte hořčík (bisglycinát) pro podporu svalové relaxace a kvalitního REM spánku.

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
Po dnešní vyšší aktivita je spánková potřeba **${sleepNeed} hodin**. Kvalitní spánek upevní vaši regeneraci i pro zítřejší den.`;
      }
      
      await new Promise(r => setTimeout(r, 1200));
      return NextResponse.json({ 
        plan: mockResponse, 
        recoveryScore, 
        targetStrain, 
        sleepNeed 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
Jsi empatický, lidský zdravotní a regenerační kouč specializovaný na péči o lidi s chronickými záněty a prevenci vzplanutí zánětu.
Řídíš se metodologií WHOOP a 3 pilíři: Regenerace (Recovery), Denní Zátěž (Strain Target) a Spánková potřeba (Sleep Need).

TVŮJ HLAVNÍ CÍL:
- Ochrana těla před vzplanutím chronického zánětu (chronický zánět je primární nepřítel).
- Přirozený, lidský, vřelý tón ("Take your time / Nespěchej, dej tělu čas").
- ŽÁDNÉ kyborgovské tréninkové drily, žádné agresivní zónové intervaly ani tlak na překonávání bolesti.
- Srozumitelná, praktická doporučení pro normální život a regeneraci.

METRIKY PRO DNEŠEK:
- Recovery Score (Regenerace): ${recoveryScore}% (${recoveryScore < 34 ? 'ČERVENÝ DEN - Riziko zánětu' : recoveryScore < 67 ? 'ŽLUTÝ DEN - Udržovací režim' : 'ZELENÝ DEN - Dobrá regenerace'})
- Doporučená cílová zátěž (Strain Target): ${targetStrain} / 21
- Vypočítaná spánková potřeba: ${sleepNeed} hodin
- Subjektivní stav a zánět: ${feeling}
- Klidová tepová frekvence (RHR): ${garminData.rhr} bpm
- Spánek minulou noc: ${garminData.sleep}h
- Včerejší aktivita: ${yesterdayActivity}
- Historie (posledních několik dní): ${JSON.stringify(history)}

FORMÁT ODPOVĚDI (Použij přesně tyto Markdown nadpisy a buď lidský a konkrétní):

### 🌿 Zhodnocení stavu zánětu a regenerace
(2-3 vřelé, lidské věty o tom, jak se tělo dnes vyrovnává se zánětem a únavou. Vysvětli jednoduše ranní čísla.)

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
(Jasné a jednoduché doporučení pro dnešní pohyb. Např. jen pohodová procházka 20 min na čerstvém vzduchu, protažení na podložce, nebo lehká aktivita pro radost bez hrocení.)

### 🛡️ Protizánětlivá péče & Výživa
(1-2 konkrétní a jednoduché praktické tipy pro dnešní den - např. protizánětlivé čaje/potraviny, dechové cvičení, vyvarování se stresu, teplo/odpočinek.)

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
(Krátké doporučení, jak si upravit večerní režim, abys dosáhl potřebných ${sleepNeed}h spánku a podpořil noční hojení zánětu.)
`;

    const modelsToTry = ['gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let planText = '';
    
    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        if (response.text) {
          planText = response.text;
          break;
        }
      } catch (e: any) {
        console.warn(`Model ${modelName} failed:`, e.message);
        if (modelName === modelsToTry[modelsToTry.length - 1]) {
          throw e;
        }
      }
    }

    if (!planText) {
      throw new Error("Nepodařilo se vygenerovat plán ze žádného dostupného modelu.");
    }

    // Save the newly generated plan to Supabase
    let saveErrorStr = null;
    try {
      await savePlan({
        date: new Date().toISOString().split('T')[0],
        feeling: feeling,
        activity: `Recovery: ${recoveryScore}% | Strain Target: ${targetStrain} | Sleep Need: ${sleepNeed}h | RHR: ${garminData.rhr} | BB: ${garminData.bodyBattery}`,
        ai_recommendation: planText
      });
    } catch (saveErr: any) {
      console.error("Uložení do historie selhalo:", saveErr);
      saveErrorStr = saveErr.message || String(saveErr);
    }

    return NextResponse.json({ 
      plan: planText, 
      recoveryScore, 
      targetStrain, 
      sleepNeed, 
      saveError: saveErrorStr 
    });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate plan' }, { status: 500 });
  }
}

