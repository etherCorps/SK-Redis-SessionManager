import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'SK Redis Session',
			logo: {
				src: './src/assets/logo.svg'
			},
			social: {
				github: 'https://github.com/etherCorps/SK-Redis-SessionManager',
				discord: 'https://discord.gg/y8yN33wQ'
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Example Guide', link: '/guides/example/' }
					]
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' }
				}
			],
			customCss: ['./src/tailwind.css']
		}),
		tailwind({ applyBaseStyles: false })
	],
	// Process images with sharp: https://docs.astro.build/en/guides/assets/#using-sharp
	image: {
		service: {
			entrypoint: 'astro/assets/services/sharp'
		}
	}
});
