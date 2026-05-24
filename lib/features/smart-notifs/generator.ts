import { generateText } from '@/lib/vertex/client';

export interface SmartNotificationMessage {
  title: string;
  body: string;
}

export async function generateSmartNotification(
  name: string,
  context: 'missing_checkin' | 'fasting_reminder' | 'weight_milestone' | 'general_motivation'
): Promise<SmartNotificationMessage> {
  
  let scenarioPrompt = "";
  if (context === 'missing_checkin') {
    scenarioPrompt = "L'utilisateur a oublié de faire son bilan quotidien du jour. Écris une notification caustique et cynique, typique de NoDream, pour lui rappeler de peser ses aliments et remplir son bilan sans délai.";
  } else if (context === 'fasting_reminder') {
    scenarioPrompt = "L'utilisateur approche de la fin de sa fenêtre de repas ou de son jeûne. Rappelle-lui de s'organiser sobrement et de s'hydrater.";
  } else if (context === 'weight_milestone') {
    scenarioPrompt = "L'utilisateur a atteint un nouveau record de régularité ou perdu du poids sur ses moyennes glissantes. Félicite-le avec froideur clinique, en rappelant que le plus dur reste à faire.";
  } else {
    scenarioPrompt = "Génère un message d'encouragement sec et axé sur la discipline pour maintenir son adhésion au plan de musculation et nutrition aujourd'hui.";
  }

  const systemInstruction = `Tu es NoDream, coach de recomposition corporelle caustique, rigoureux et cynique. Credo : "Pas de rêve. Des résultats." Tu tutoies l'utilisateur ("tu"). Ton but est de générer une notification push très courte et percutante.
Pas d'emojis superflus (max 1), pas de confettis ou de phrases d'infantilisation.

Tu dois impérativement répondre au format JSON exact suivant :
{
  "title": "Titre court (max 40 caractères)",
  "body": "Message percutant (max 120 caractères)"
}`;

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `Prénom de l'utilisateur : ${name}. Contexte : ${scenarioPrompt}`,
        },
      ],
    },
  ];

  try {
    const responseText = await generateText({
      model: 'gemini-2.5-flash',
      contents,
      systemInstruction,
      temperature: 0.7,
      responseMimeType: 'application/json',
    });

    if (!responseText) {
      throw new Error("Empty AI notification response.");
    }

    const data = JSON.parse(responseText);
    return {
      title: data.title || "Discipline d'acier",
      body: data.body || "Bilan du jour manquant, saisis tes données.",
    };
  } catch (error) {
    console.error("Smart notification generation failed:", error);
    // Secure fallback message
    return {
      title: "Bilan en attente",
      body: `Hé ${name}, la régularité fait le résultat. Viens saisir ton bilan quotidien.`,
    };
  }
}
