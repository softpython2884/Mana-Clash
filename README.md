# Mana Clash

Bienvenue sur Mana Clash, un jeu de cartes tactique en ligne inspiré par des classiques comme *Magic: The Gathering* et *Hearthstone*. Ce projet a été développé pour être à la fois un jeu amusant et une plateforme extensible et open source (pour le moment :P) .



## Comment Jouer ?

### Objectif du Jeu
Le but est simple : réduire les points de vie (PV) de votre adversaire de 20 à 0 avant qu'il ne fasse de même avec vous !

### Déroulement d'un Tour
Chaque tour se déroule en plusieurs phases pour le joueur actif :

1.  **Début du Tour** :
    *   Vous piochez une carte.
    *   Votre mana maximum augmente de 1 (jusqu'à un maximum de 10).
    *   Votre mana est entièrement rechargé.
    *   Vos créatures "se réveillent" : elles peuvent à nouveau attaquer.

2.  **Phase Principale (Main Phase)** :
    *   **Jouer des cartes** : Vous pouvez jouer des créatures, des terrains, des sorts ou des artefacts depuis votre main en dépensant du mana.
    *   **Utiliser des compétences** : Certaines créatures sur le plateau ont des compétences activables.
    *   **Méditer** : Si vous ne souhaitez pas attaquer, vous pouvez choisir de "Méditer" avant de passer votre tour pour récupérer une carte aléatoire de votre cimetière.

3.  **Phase de Combat (Combat Phase)** :
    *   Cliquez sur le bouton "Combat".
    *   **Choisissez un attaquant** : Sélectionnez une de vos créatures sur le terrain qui est prête à attaquer.
    *   **Choisissez une cible** : Sélectionnez une créature adverse à attaquer. S'il n'a pas de créature avec "Provocation", vous pouvez attaquer directement le joueur s'il n'a aucune créature pour le défendre.
    *   L'attaque se résout, et la créature attaquante est "couchée" (elle ne pourra plus attaquer ce tour-ci).
    *   Vous pouvez répéter l'opération s'il vous reste des attaquants. Le jeu quittera automatiquement la phase de combat si vous n'avez plus d'attaquants disponibles.

4.  **Fin du Tour** :
    *   Cliquez sur "Fin du tour" pour passer la main à votre adversaire.

### Les Types de Cartes

*   **Créatures** : Vos unités de base pour attaquer et défendre. Elles possèdent des points d'attaque, de santé et parfois d'armure ou des compétences spéciales. Elles ne peuvent généralement pas attaquer le tour où elles sont jouées (mal d'invocation).
*   **Terrains** : Jouer une carte terrain (une seule par tour autorisée) augmente votre mana maximum de 1 de façon permanente. C'est la base de votre montée en puissance.
*   **Sorts** : Des effets uniques et instantanés. Ils peuvent infliger des dégâts, soigner, renforcer une créature (buff), ou affaiblir un ennemi (debuff). Une fois joués, ils vont au cimetière.
*   **Artefacts** : Des objets qui restent sur le terrain pendant un nombre de tours défini et appliquent un effet passif, comme renforcer toutes vos créatures.
*   **Biomes** : Des cartes spéciales qui changent l'environnement du plateau de jeu. Un biome peut donner des bonus à certaines créatures qui y sont associées.

---

## Guide pour les Contributeurs (Open Source)

Mana Clash est conçu pour être étendu ! Voici comment vous pouvez ajouter votre propre contenu au jeu.

### Ajouter une Nouvelle Carte

Ajouter une carte est un processus simple en 3 étapes.

#### 1. Définir la Carte dans `initial-cards.ts`

Ouvrez le fichier `src/data/initial-cards.ts`. Vous y trouverez une fonction `createCard` qui facilite la création. Suivez la structure existante pour ajouter votre carte.

**Exemple : Ajouter une nouvelle créature**
```javascript
createCard(
  'nom_unique_id',      // Un ID unique en minuscules
  'Nom de la Carte',      // Le nom affiché
  'Creature',             // Le type de carte
  3,                      // Coût en mana
  "Description de l'effet.", // Description affichée sur la carte
  {
    attack: 3,
    health: 4,
    armor: 1,
    rarity: 'Rare',
    preferredBiome: 'Forest' // Optionnel
  }
),
```

#### 2. Ajouter une Image pour la Carte

Pour que votre carte ait un visuel, ouvrez `src/lib/placeholder-images.json` et ajoutez une nouvelle entrée pour votre carte en utilisant le même `id` que celui défini à l'étape 1.

**Exemple :**
```json
{
  "id": "nom_unique_id",
  "description": "Une description pour l'image.",
  "imageUrl": "https://picsum.photos/seed/votre_seed/300/400",
  "imageHint": "mots clés" // Pour une future recherche d'images IA
}
```

#### 3. Ajouter la Carte au Deck de Départ

Pour que votre carte apparaisse en jeu, ajoutez-la à la fonction `createDeck()` dans `src/data/initial-cards.ts`.

**Exemple :**
```javascript
// Dans la fonction createDeck()
addCards('nom_unique_id', 2); // Ajoute 2 exemplaires de cette carte au deck
```

### Ajouter une Nouvelle Compétence ou un Nouvel Effet

C'est ici que la magie opère ! Pour créer une nouvelle mécanique de jeu, vous devrez principalement travailler dans `src/lib/game-reducer.ts`.

1.  **Définir le type de compétence** : Dans `src/lib/types.ts`, ajoutez le nom de votre nouvelle compétence à `SkillType`.
    ```typescript
    export type SkillType =
      | 'taunt'
      | 'heal'
      | 'votre_nouvelle_competence'; // Ajoutez ici
    ```

2.  **Implémenter la logique** : Dans `src/lib/game-reducer.ts`, trouvez la section appropriée (par exemple, dans l'action `CAST_SPELL_ON_TARGET` ou `ACTIVATE_SKILL`) et ajoutez un `case` pour votre nouvelle compétence.
    ```javascript
    // Dans le switch (spellOrSkillCaster.skill?.type)
    case 'votre_nouvelle_competence':
      // Votre logique ici.
      // Par exemple, modifiez la santé de la cible, piochez des cartes, etc.
      log.push({ type: 'skill', turn, message: `Effet incroyable se produit !` });
      break;
    ```

3.  **Lier la compétence à une carte** : Dans `initial-cards.ts`, vous pouvez maintenant assigner votre nouvelle compétence à une carte.
    ```javascript
    createCard('carte_speciale', 'Carte avec Super Effet', 'Creature', 5, 'Fait un truc génial.', {
      skill: { type: 'votre_nouvelle_competence', used: false, cooldown: 3 }
    }),
    ```

### Technologies Utilisées
*   **Framework** : Next.js (App Router) & React
*   **Style** : Tailwind CSS & shadcn/ui
*   **Logique IA** : Genkit (Google)
*   **Langage** : TypeScript

N'hésitez pas à forker le projet, à expérimenter et à proposer des améliorations !
