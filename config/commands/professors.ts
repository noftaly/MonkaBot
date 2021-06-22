/* eslint-disable import/prefer-default-export */
import { stripIndent } from 'common-tags';

/*
interface Properties {
  [x: string]: boolean | number | Properties | Properties[] | string;
}

interface OptionProperties {
  aliases: string[];
  description: string;
  enabled: boolean;
  usage: string;
  examples: string[];
}

type ArgPrompts = Record<string, {
    base: string;
    invalid: string;
  }>;

interface CommandMessages {
  options: OptionProperties;
  messages: Properties & { prompts: ArgPrompts };
}
*/

export const eclass = {
  options: {
    aliases: ['cours', 'class', 'ecours', 'eclass', 'e-cours', 'e-class'],
    description: stripIndent`
      Commande permettant de créer un cours. Vous pouvez utiliser \`!cours create\` ou \`!cours add\` suivit de tous les arguments nécessaires (\`!cours help\`), ou vous laisser guider par \`!cours setup\`.
      Quand le cours sera créé, des messages seront envoyés dans les bons salons pour prévenir les membres, et un rôle spécial sera créé pour que les personnes voulant assister au cours puissent être notifiées.
      Vous pourrez ensuite lancer le cours manuellement avec \`!cours start @role-spécial\`. Le cours s'arrêtera au bout de la durée spécifiée. S'il se finit avant, vous pouvez l'arrêter manuellement avec \`cours finish @role-spécial\`
    `,
    enabled: true,
    usage: 'cours <add|setup|help|start>',
    examples: ['!cours setup', '!cours add #⚡-electricité-générale "Low and High pass filters" 24/04 20h30 2h15 @professeur @L1', '!cours start'],
  },
  messages: {
    // Global
    invalidClassId: "Désolé, mais cet identifiant n'est pas valide. L'identifiant de la classe a été envoyé quand elle a été crée, et il est toujours disponible dans l'embed d'annonce du cours.",
    onlyProfessor: 'Seul les professeurs peuvent effectuer cette action !',
    unresolvedProfessor: ':x: Impossible de retrouver le professeur pour ce cours !',
    unconfiguredChannel: "Oups, impossible de créer ce cours car aucun salon n'a été configuré pour les annonces. Configurez-en un en tapant la commande `setup class` dans le bon salon.",
    editUnauthorized: "Tu ne peux pas modifier un cours qui n'est pas a toi !",
    statusIncompatible: 'Tu ne peux pas faire cette action alors que le cours {status}',

    // Statuses
    statuses: {
      planned: "n'est pas encore commencé",
      inProgress: 'est en cours',
      finished: 'est terminé',
      canceled: 'est annulé',
    },

    // Help subcommand
    helpEmbedTitle: 'Aide de la commande de cours',
    helpEmbedDescription: [
      { name: "Créer un cours à partir d'arguments donnés", value: '`!cours create <#salon | salon | ID> <sujet> <date> <heure> <durée> <@professeur | professeur | ID> <@role-audience | role audience | ID> <oui/non enregistré>`' },
      { name: 'Créer un cours de manière intéractive', value: '`!cours setup`' },
      { name: 'Commencer un cours', value: '`!cours start ID-cours`' },
      { name: 'Terminer un cours manuellement', value: '`!cours finish ID-cours`' },
      { name: 'Modifier un cours', value: '`!cours edit ID-cours <propriété> <valeur>`\n`propriété`: "sujet", "date", "heure", "durée", "professeur", "rôle", "enregistré"' },
      { name: 'Annuler un cours', value: '`!cours cancel ID-cours`' },
      { name: "Page d'aide", value: '`!cours help`' },
    ],

    // Create subcommand
    successfullyCreated: 'Le cours a bien été créé ! Son ID est {eclass.classId}',
    alreadyExists: 'Ce cours (même matière, sujet, heure, jour) a déjà été prévu !',
    newClassNotification: ':bell: {targetRole}, un nouveau cours a été plannifié ! :arrow_heading_down:',

    invalidDate: "Cette date/heure est invalide. Vérifie bien qu'elle ne soit pas passée et qu'elle soit prévue pour dans moins de 2 mois.",

    newClassEmbed: {
      title: '{subject} - {topic}',
      description: "Un nouveau cours en {classChannel} a été planifié sur Ef'Réussite !\nRéagis avec :white_check_mark: pour être notifié du cours !",
      author: "Ef'Réussite - Nouveau cours !",
      date: 'Date et heure',
      duration: 'Durée prévue',
      professor: 'Professeur',
      recorded: 'Enregistré',
      recordedValues: ['Non :x:', 'Oui :white_check_mark:'],
      footer: 'ID : {eclass.classId}',
    },

    // Edit subcommand
    invalidEditProperty: 'Cette propriété est invalide. Choisissez parmi "sujet", "date", "heure", "durée", "professeur", "rôle".',

    editedTopic: 'Vous avez bien modifié le thème du cours en "{eclass.topic}".',
    pingEditedTopic: '{role}, le cours a été modifié : le thème a été changé en "{eclass.topic}".',

    editedDate: 'Vous avez bien modifié la date du cours pour le {eclass.date}.',
    pingEditedDate: '{role}, le cours a été modifié : la date a été changée pour le {eclass.date}.',

    editedHour: "Vous avez bien modifié l'heure du cours pour le {eclass.date}.",
    pingEditedHour: "{role}, le cours a été modifié : l'heure a été changée pour le {eclass.date}.",

    editedDuration: 'Vous avez bien modifié la durée du cours en {eclass.duration}.',
    pingEditedDuration: '{role}, le cours a été modifié : la durée a été changée en {eclass.duration}.',

    editedProfessor: 'Vous avez bien modifié le professeur du cours qui est maintenant <@{eclass.professor}>.',
    pingEditedProfessor: '{role}, le cours a été modifié : le professeur est maintenant <@{eclass.professor}>.',

    editedRole: 'Vous avez bien modifié le rôle visé en "{eclass.role}".',
    pingEditedRole: '{role}, le cours a été modifié : le rôle visé est maintenant "{eclass.role}".',

    editedRecorded: "Vous avez bien modifié le statut d'enregistrement du cours en `{eclass.isRecorded}`.",
    pingEditedRecorded: '{role}, le cours a été modifié : ',
    pingEditedRecordedValues: ['il ne sera plus enregistré.', 'il sera maintenant enregistré.'],

    // Start subcommand
    successfullyStarted: 'Le cours a bien été lancé !',
    startClassNotification: ':bell: <@&{classRole}>, le cours commence !',
    remindClassNotification: ':bell: <@&{classRole}> rappel : le cours commence dans {duration}',
    remindClassPrivateNotification: ":bell: Tu t'es inscrit au cours \"{eclass.topic}\". Il va commencer dans environ 15 minutes ! Tien-toi prêt :\\)",
    valueInProgress: '[En cours]',

    startClassEmbed: {
      title: 'Le cours en {eclass.subject} va commencer !',
      author: "Ef'Réussite - Un cours commence !",
      description: 'Le cours en **{eclass.subject}** sur "**{eclass.topic}**" présenté par <@{eclass.professor}> commence ! Le salon textuel associé est <#{eclass.classChannel}>',
      footer: 'ID : {eclass.classId}',
    },

    // Finish subcommand
    successfullyFinished: 'Le cours a bien été terminé !',
    finishUnauthorized: "Tu n'es pas autoriser à terminer ce cours !",
    notFinishable: "Ce cours n'est pas lancé, tu ne peux donc pas le terminer !",
    valueFinished: '[Terminé]',

    // Cancel subcommand
    successfullyCanceled: 'Le cours a bien été archivé !',
    cancelUnauthorized: "Tu n'es pas autorisé à archiver ce cours !",
    valueCanceled: ':warning: **__COURS ANNULÉ !__**',

    // Subscribing
    subscribed: "Tu t'es bien inscrit au cours de \"{topic}\" ({subject}) ! Je te le rappellerai un peu avant :)",
    unsubscribed: "Tu t'es bien désinscrit du cours de \"{topic}\" ({subject}) !",

    stoppedPrompting: "Tu as bien abandonné la commande ! Aucun cours n'a été créé.",

    // Prompts
    prompts: {
      classChannel: {
        base: 'Entrez le salon associé au cours que vous souhaitez donner (mentionnez-le ou entrez son nom ou son ID) :',
        invalid: 'Ce salon de cours est invalide.',
      },
      topic: {
        base: 'Entrez le sujet du cours que vous souhaitez donner (nom du chapitre, thème du cours...) :',
        invalid: 'Ce sujet est invalide.',
      },
      date: {
        base: 'Entrez la date du cours que vous souhaitez donner (au format "jj/MM") :',
        invalid: 'Cette date est invalide.',
      },
      hour: {
        base: "Entrez l'heure de début du cours que vous souhaitez donner (au format \"HH:mm\") :",
        invalid: 'Cette heure est invalide.',
      },
      duration: {
        base: 'Entrez une durée pour votre cours (en anglais ou en francais).\nVous pouvez par exemple entrer `30min` pour 30 minutes et `2h` pour 2 heures. Vous pouvez également combiner ces durées ensemble : `2h30min` est par exemple une durée valide.',
        invalid: 'Cette durée est invalide.',
      },
      professor: {
        base: 'Entrez le professeur qui va donner le cours (mentionnez-le ou entrez son pseudo ou son ID) :',
        invalid: 'Ce membre est invalide.',
      },
      targetRole: {
        base: 'Entrez le rôle visé (L1, L2...) (mentionnez-le ou entrez son nom ou son ID) :',
        invalid: 'Ce rôle est invalide.',
      },
      isRecorded: {
        base: 'Entrez si oui ou non le cours sera enregistré (oui/o/yes/y | non/no/n) :',
        invalid: 'Cette valeur est invalide.',
      },
    },
  },
};
