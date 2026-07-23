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
    
    // WHOOP & GARMIN Metrics Calculations
    // 1. Recovery Score (0-100%)
    let sleepRatio = Math.min(garminData.sleep / 8.0, 1.2);
    let sleepScore = sleepRatio * 100;
    
    // Impact of feeling on recovery
    let feelingPenalty = 0;
    if (feeling.includes('zánět') || feeling.includes('Vyčerpání') || feeling.includes('Nemoc')) {
      feelingPenalty = 35;
    } else if (feeling.includes('únava') || feeling.includes('Tuhost')) {
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
    let sleepNeed = 8.0;
    if (recoveryScore < 34 || feelingPenalty >= 35) {
      sleepNeed += 1.2;
    } else if (recoveryScore < 67) {
      sleepNeed += 0.5;
    }
    sleepNeed = Math.round(sleepNeed * 10) / 10;

    // 4. GARMIN Metric: Training Readiness (Připravenost k tréninku - 0-100%)
    let readinessBonus = 0;
    if (yesterdayActivity.includes('Odpočinek') || yesterdayActivity.includes('Lehké')) {
      readinessBonus = 10;
    } else if (yesterdayActivity.includes('Běh') || yesterdayActivity.includes('Stres')) {
      readinessBonus = -12;
    } else if (yesterdayActivity.includes('Kolo')) {
      readinessBonus = -8;
    }

    let trainingReadiness = Math.round(recoveryScore * 0.85 + readinessBonus);
    if (garminData.rhr > 58) trainingReadiness -= 8;
    if (feelingPenalty >= 35) trainingReadiness = Math.min(trainingReadiness, 22);
    if (trainingReadiness > 100) trainingReadiness = 100;
    if (trainingReadiness < 0) trainingReadiness = 0;

    let readinessLabel = 'Špičková';
    if (trainingReadiness < 25) readinessLabel = 'Špatná (Stopka)';
    else if (trainingReadiness < 50) readinessLabel = 'Nízká';
    else if (trainingReadiness < 75) readinessLabel = 'Střední';
    else if (trainingReadiness < 90) readinessLabel = 'Vysoká';

    // 5. GARMIN Metric: Recovery Time (Doba regenerace v hodinách: 0-72h)
    let baseRecoveryHours = 0;
    if (yesterdayActivity.includes('Běh')) baseRecoveryHours = 32;
    else if (yesterdayActivity.includes('Kolo')) baseRecoveryHours = 24;
    else if (yesterdayActivity.includes('Chůze')) baseRecoveryHours = 12;
    else if (yesterdayActivity.includes('Stres')) baseRecoveryHours = 20;
    else if (yesterdayActivity.includes('Lehké')) baseRecoveryHours = 4;
    else baseRecoveryHours = 0;

    let sleptHours = garminData.sleep;
    let hoursRecoveredOvernight = Math.round(sleptHours * (recoveryScore / 50));
    let recoveryTimeHours = Math.max(0, baseRecoveryHours - hoursRecoveredOvernight);

    if (feelingPenalty >= 35) {
      recoveryTimeHours += 24; // Active inflammation delays full recovery
    } else if (feelingPenalty >= 18) {
      recoveryTimeHours += 12;
    }

    if (recoveryTimeHours > 72) recoveryTimeHours = 72;

    // Fetch real history for context
    const history = await getHistory();

    const apiKey = process.env.GEMINI_API_KEY || 'mock-key-for-dev';
    
    // Pro vývoj bez API klíče vracíme lidský, protizánětlivý mock
    if (apiKey === 'mock-key-for-dev') {
      let mockResponse = '';
      if (recoveryScore < 34 || feelingPenalty >= 35) {
        mockResponse = `### 🌿 Zhodnocení stavu zánětu a regenerace\nTělo dnes signalizuje zvýšené zánětlivé zatížení a únavu. Vaše regenerace je na **${recoveryScore}%** a Připravenost k tréninku je **${trainingReadiness}% (${readinessLabel})**. Do plné regenerace zbývá přibližně **${recoveryTimeHours} hodin**. Není kam spěchat – nespěchej a dej tělu čas.

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
Dnes vynechejte jakékoliv náročné tréninky, běh i jízdu na kole. Ideální je **striktní odpočinek** nebo jen velmi lehká procházka na čerstvém vzduchu (max 15-20 minut pohodovým krokem bez pocení).

### 🛡️ Protizánětlivá péče & Výživa
* **Bylinkový čaj:** Připravte si teplý kurkumový nebo zázvorový čaj s citrónem.
* **Hydratace & Strava:** Doplňte dostatek čisté vody a vyhněte se průmyslově zpracovaným cukrům, které podporují zánět.
* **Relaxace:** Dopřejte si 10 minut vědomého dýchání nebo teplou sprchu před spaním.

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
Protože tělo bojuje se zánětem, vaše spánková potřeba pro dnešek je **${sleepNeed} hodin**. Zkuste jít spát o 45 minut dříve než obvykle.`;
      } else if (recoveryScore < 67) {
        mockResponse = `### 🌿 Zhodnocení stavu zánětu a regenerace\nVaše regenerace je na **${recoveryScore}%** a Připravenost k tréninku je **${trainingReadiness}% (${readinessLabel})**. Doba do plné regenerace je odhadována na **${recoveryTimeHours}h**. Tělo je ve stabilním udržovacím stavu.

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
Dnes je skvělý den pro **aktivní regeneraci**. Můžete zařadit lehkou procházku, nenáročné protažení na podložce nebo volnou jízdu na kole bez vysoké tepovky. Vyhněte se tréninku do vyčerpání.

### 🛡️ Protizánětlivá péče & Výživa
* **Omega-3 & Zdravé tuky:** Zařaďte do jídelníčku hrst vlašských ořechů, lněná semínka nebo rybu.
* **Jemná mobilita:** 15 minut lehkého uvolnění pomůže odvodu toxinů.

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
Doporučená délka spánku pro dnešní noc je **${sleepNeed} hodin**.`;
      } else {
        mockResponse = `### 🌿 Zhodnocení stavu zánětu a regenerace\nSkvělá zpráva! Vaše tělo je plně regenerované (Recovery **${recoveryScore}%**), Připravenost k tréninku je **${trainingReadiness}% (${readinessLabel})** a Doba regenerace je **${recoveryTimeHours}h**.

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
Dnes má tělo zelenou pro **plnohodnotný trénink nebo aktivní den** (běh nebo jízdu na kole). Stále si však všímejte signálů těla a nepřesahujte rozumnou hranici.

### 🛡️ Protizánětlivá péče & Výživa
* **Kvalitní doplňování paliva:** Nezapomeňte po tréninku doplnit sacharidy a kvalitní bílkoviny pro rychlou obnovu tkání.
* **Hořčík:** Večer zařaďte hořčík (bisglycinát) pro podporu svalové relaxace.

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
Spánková potřeba je **${sleepNeed} hodin**.`;
      }
      
      await new Promise(r => setTimeout(r, 1200));
      return NextResponse.json({ 
        plan: mockResponse, 
        recoveryScore, 
        targetStrain, 
        sleepNeed,
        trainingReadiness,
        readinessLabel,
        recoveryTimeHours
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
Jsi empatický, lidský zdravotní a regenerační kouč specializovaný na péči o lidi s chronickými záněty a prevenci vzplanutí zánětu.
Řídíš se fúzí nejlepších metodologií z WHOOP (Recovery %, Strain Target 0–21, Sleep Need), ELONGA (ANS rovnováha) a GARMIN (Připravenost k tréninku / Training Readiness & Doba regenerace / Recovery Time).

TVŮJ HLAVNÍ CÍL:
- Ochrana těla před vzplanutím chronického zánětu (chronický zánět je primární nepřítel).
- Udržovat převahu Parasympatiku (hojivý, protizánětlivý režim) a bránit přetížení Sympatiku (stres, imunitní poplach).
- Přirozený, lidský, vřelý tón ("Take your time / Nespěchej, dej tělu čas").
- ŽÁDNÉ kyborgovské tréninkové drily, žádné agresivní zónové intervaly ani tlak na překonávání bolesti.

PREFEROVANÉ AKTIVITY UŽIVATELE:
- Uživatel se věnuje VÝHRADNĚ těmto aktivitám: Kolo (Jízda na kole), Běh, Chůze / Hike (Turistika), Lehké protažení / Mobilita nebo Odpočinek / Volno.

METRIKY PRO DNEŠEK:
- Recovery Score (Regenerace): ${recoveryScore}% (${recoveryScore < 34 ? 'ČERVENÝ DEN - Riziko zánětu' : recoveryScore < 67 ? 'ŽLUTÝ DEN - Udržovací režim' : 'ZELENÝ DEN - Dobrá regenerace'})
- Připravenost k tréninku (Training Readiness): ${trainingReadiness}% (${readinessLabel})
- Doba regenerace (Recovery Time): ${recoveryTimeHours} hodin
- Doporučená cílová zátěž (Strain Target): ${targetStrain} / 21
- Vypočítaná spánková potřeba: ${sleepNeed} hodin
- Subjektivní stav a zánět: ${feeling}
- Klidová tepová frekvence (RHR): ${garminData.rhr} bpm
- Spánek minulou noc: ${garminData.sleep}h
- Včerejší aktivita: ${yesterdayActivity}
- Historie (posledních několik dní): ${JSON.stringify(history)}

FORMÁT ODPOVĚDI (Použij přesně tyto Markdown nadpisy):

### 🌿 Zhodnocení stavu zánětu a regenerace
(2-3 vřelé, lidské věty o tom, jak se tělo dnes vyrovnává se zánětem a únavou. Zohledni Připravenost k tréninku ${trainingReadiness}% a Dobu regenerace ${recoveryTimeHours}h.)

### 🎯 Doporučená zátěž (Strain Target: ${targetStrain} / 21)
(Jasné a jednoduché doporučení pro dnešní pohyb z preferovaných aktivit uživatele.)

### 🛡️ Protizánětlivá péče & Výživa
(1-2 konkrétní a jednoduché praktické tipy pro dnešní den.)

### 😴 Spánková potřeba pro dnešní noc (${sleepNeed}h)
(Krátké doporučení k večernímu režimu.)
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
        activity: `Recovery: ${recoveryScore}% | Readiness: ${trainingReadiness}% | RecTime: ${recoveryTimeHours}h | Strain: ${targetStrain} | SleepNeed: ${sleepNeed}h | RHR: ${garminData.rhr}`,
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
      trainingReadiness,
      readinessLabel,
      recoveryTimeHours,
      saveError: saveErrorStr 
    });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate plan' }, { status: 500 });
  }
}


