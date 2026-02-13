import { redirect, notFound } from 'next/navigation';

const redirects: Record<string, string> = {
  'retreat-signup-form': 'https://forms.gle/Km3ZYZbnctYR1oDs6',
  'membership-form': 'https://forms.gle/scCH6xnyZphLSBCPA',
  // more events (e.g. weekend event, gen meeting sign in form, etc.)
};

export default function RedirectPage({
  params,
}: {
  params: { slug: string };
}) {
  const destination = redirects[params.slug];

  if (!destination) {
    notFound();
  }

  redirect(destination);
}
