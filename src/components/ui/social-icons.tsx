import type { ComponentType, SVGProps } from 'react';
import { Ghost, Linkedin, Pin, Twitter, Youtube } from 'lucide-react';
import { FacebookIcon, InstagramIcon, TikTokIcon } from './icons';
import type { SocialKey } from '@/lib/site-settings';

/** One icon per supported social network (used by the footer and the contact page). */
export const SOCIAL_ICONS: Record<SocialKey, ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  youtube: Youtube,
  x: Twitter,
  snapchat: Ghost,
  pinterest: Pin,
  linkedin: Linkedin,
};

/** Short line shown under the name on the contact page. */
export const SOCIAL_BLURB: Record<SocialKey, string> = {
  instagram: 'Follow for new scents',
  facebook: 'Join the page',
  tiktok: 'Watch on TikTok',
  youtube: 'Watch on YouTube',
  x: 'Follow on X',
  snapchat: 'Add us on Snapchat',
  pinterest: 'See our boards',
  linkedin: 'Connect on LinkedIn',
};
