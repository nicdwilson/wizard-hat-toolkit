import Wizardhat from './Wizardhat';
import fs from 'fs';
import path from 'path';
const packageJSON = JSON.parse(fs.readFileSync( path.join( __dirname, '../package.json' ), 'utf8' ));
const addonName = packageJSON['productName'];
const addonID = packageJSON['slug'];

export default function ( context ) {
	console.log('[Wizard Hat Toolkit] Renderer process starting...');
	
	const {React, hooks} = context;
	const {Route} = context.ReactRouter;
	const stylesheetPath = path.resolve(__dirname, '../style.css');
	//insert our stylesheet
	hooks.addContent('stylesheets', () => <link rel="stylesheet" key="notes-addon-styleesheet" href={stylesheetPath} />);
	
	console.log('[Wizard Hat Toolkit] Renderer initialized successfully');

	hooks.addContent('routesSiteInfo', () =>
		<Route key="woocommerce-addon-tab" path="/main/site-info/:siteID/woocommerce" render={props => <Wizardhat {...props} />} />
	);

	// Add WooCommerce to the More menu
	hooks.addFilter('siteInfoMoreMenu', function(menu, site) {
		menu.push({
			label: 'WooCommerce',
			enabled: true,
			click: () => {
				context.events.send('goToRoute', `/main/site-info/${site.id}/woocommerce`);
			}
		});
		return menu;
	});
}
