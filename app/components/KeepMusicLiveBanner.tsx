import Link from 'next/link'
import styles from './KeepMusicLiveBanner.module.css'

// Home page CTA banner for /live-music. Same photo, headline and colors as
// the Live Music page hero, just shorter, so it reads as a teaser for that
// page rather than a second hero. The whole banner is one link.
const HERO_IMG =
  'https://pjuyzybsyguuqaesiiyu.supabase.co/storage/v1/object/public/site-images/hero-images/ILove90s-TylerStruck-Web.jpg'

export default function KeepMusicLiveBanner() {
  return (
    <section className={styles.wrap} aria-label="Live music in Topeka">
      <Link href="/live-music" className={styles.banner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_IMG} alt="" className={styles.img} loading="lazy" />
        <div className={styles.body}>
          <p className={styles.eyebrow}>seveneightfive</p>
          <h2 className={styles.title}>
            Keep <span>Music</span> Live
          </h2>
          <p className={styles.byline}>— Suki</p>
          <p className={styles.sub}>Your guide to live music in Top City.</p>
          <span className={styles.cta}>Upcoming Concerts</span>
        </div>
        <p className={styles.credit}>Photo by Tyler Strunk</p>
      </Link>
    </section>
  )
}
