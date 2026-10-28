import { AppHeader } from '@/components/AppHeader';
import { PageContainer } from '@/components/PageContainer';
import { PageTitle } from '@/components/PageTitle';
import { getPageUser } from '@/modules/auth';
import { getClubService } from '@/modules/club';

export const dynamic = 'force-dynamic';
export const metadata = { title: "Mentions d'information" };

const SECTION = 'flex flex-col gap-sm';
const HEADING = 'text-large font-bold text-text';

// T-021, security.md section 4 "Données et RGPD": public, linked from the footer of every page.
export default async function LegalNoticePage() {
  // Before the installation there is no club yet
  const club = await getClubService()
    .getClub()
    .then((found) => found.name)
    .catch(() => null);

  return (
    <>
      <AppHeader user={await getPageUser()} />
      <PageContainer narrow>
        <PageTitle>Mentions d&apos;information</PageTitle>
        <section className={SECTION}>
          <h2 className={HEADING}>Qui est responsable de tes données ?</h2>
          <p>
            {club ? `Le club « ${club} »` : 'Le club qui utilise cette instance de Créno'} est
            responsable du traitement. Pour le joindre, adresse-toi à un administrateur du club.
          </p>
        </section>
        <section className={SECTION}>
          <h2 className={HEADING}>Pourquoi et quelles données ?</h2>
          <p>
            Le club garde ton nom, ton prénom et ton adresse e-mail pour te permettre de te
            connecter, de t&apos;inscrire à des créneaux et de permettre aux administrateurs de
            suivre le remplissage. Ton mot de passe est stocké sous une forme qui ne permet pas de
            le relire. Les autres bénévoles voient ton prénom et l&apos;initiale de ton nom sur les
            créneaux où tu es inscrit.
          </p>
        </section>
        <section className={SECTION}>
          <h2 className={HEADING}>Combien de temps ?</h2>
          <p>
            Tant que ton compte existe. Quand tu le supprimes, ton nom, ton prénom et ton e-mail
            sont effacés ; tes inscriptions à des créneaux qui n&apos;ont pas commencé sont
            libérées, et celles des créneaux déjà commencés restent sous la mention « ancien membre
            », sans aucun lien avec toi. Les sauvegardes chiffrées du serveur (7 jours, puis une par
            mois) s&apos;effacent à leur tour selon ce roulement.
          </p>
        </section>
        <section className={SECTION}>
          <h2 className={HEADING}>Cookies et hébergement</h2>
          <p>
            Créno n&apos;utilise qu&apos;un cookie de session, nécessaire à la connexion (30 jours),
            et aucun cookie de suivi ni de tiers. Les données sont hébergées dans l&apos;Union
            européenne.
          </p>
        </section>
        <section className={SECTION}>
          <h2 className={HEADING}>Tes droits</h2>
          <ul className="flex list-disc flex-col gap-sm pl-md">
            <li>
              <strong>Effacement</strong> : tu supprimes toi-même ton compte et tes données depuis
              le menu de ton prénom, « Supprimer mon compte ».
            </li>
            <li>
              <strong>Accès et rectification</strong> : tu consultes et tu corriges toi-même ton
              nom, ton prénom et ton e-mail depuis le menu de ton prénom, « Mon profil ».
            </li>
            <li>
              <strong>Export</strong> : pour l&apos;instant, demande-le à un administrateur du club,
              qui te remet tes données.
            </li>
            <li>
              Si tu penses que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr).
            </li>
          </ul>
        </section>
      </PageContainer>
    </>
  );
}
