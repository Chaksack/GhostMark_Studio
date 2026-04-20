<template>
  <div>
    <AppHeader :categories="categories" />

    <main class="pb-[60px]">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
const categories = [
  {
    key: 'apparel',
    label: 'Apparel',
    to: '/products?c=apparel',
    menu: {
      featuredTitle: 'Cut-and-sew staples for your everyday uniform.',
      featuredDescription: 'Heavyweight hoodies, crisp tees, and premium outerwear selected for teams, launches, and employee kits.',
      featuredBackground: 'linear-gradient(135deg, #f4eedc 0%, #efe2bf 54%, #e4d7ba 100%)',
      sections: [
        {
          title: 'Apparel',
          items: [
            { label: 'Hoodies', to: '/products?c=apparel&style=hoodies' },
            { label: 'Sweatshirts', to: '/products?c=apparel&style=sweatshirts' },
            { label: 'T-shirts', to: '/products?c=apparel&style=t-shirts' },
            { label: 'Long sleeves', to: '/products?c=apparel&style=long-sleeves' },
            { label: 'Shirts', to: '/products?c=apparel&style=shirts' },
            { label: 'Jackets', to: '/products?c=apparel&style=jackets' },
            { label: 'Activewear', to: '/products?c=apparel&style=activewear' },
            { label: 'Accessories', to: '/products?c=apparel&style=accessories' },
          ],
        },
        {
          title: 'Featured',
          items: [
            { label: 'Starter merch kits', to: '/products?c=apparel&feature=starter-kits' },
            { label: 'Made in Europe', to: '/products?c=apparel&origin=europe' },
            { label: 'Organic cotton', to: '/products?c=apparel&material=organic-cotton' },
            { label: 'Best sellers', to: '/products?c=apparel&sort=bestsellers' },
          ],
        },
      ],
    },
  },
  {
    key: 'bags',
    label: 'Bags',
    to: '/products?c=bags',
    menu: {
      featuredTitle: 'Carry pieces built for events, onboarding, and retail drops.',
      featuredDescription: 'Structured totes, tech sleeves, and travel bags designed to feel considered instead of disposable.',
      featuredBackground: 'linear-gradient(135deg, #eee5d7 0%, #d8c1a7 52%, #cbb193 100%)',
      sections: [
        {
          title: 'Bags',
          items: [
            { label: 'Tote bags', to: '/products?c=bags&style=totes' },
            { label: 'Backpacks', to: '/products?c=bags&style=backpacks' },
            { label: 'Laptop sleeves', to: '/products?c=bags&style=laptop-sleeves' },
            { label: 'Crossbody bags', to: '/products?c=bags&style=crossbody' },
            { label: 'Travel duffels', to: '/products?c=bags&style=duffels' },
          ],
        },
        {
          title: 'Use cases',
          items: [
            { label: 'Conference swag', to: '/products?c=bags&use=conference' },
            { label: 'Welcome kits', to: '/products?c=bags&use=onboarding' },
            { label: 'Client gifting', to: '/products?c=bags&use=gifting' },
            { label: 'Retail-ready', to: '/products?c=bags&use=retail' },
          ],
        },
      ],
    },
  },
  {
    key: 'headwear',
    label: 'Headwear',
    to: '/products?c=headwear',
    menu: {
      featuredTitle: 'Caps and beanies that keep your logo understated and sharp.',
      featuredDescription: 'Low-profile silhouettes, elevated materials, and finish details that make branded headwear feel wearable.',
      featuredBackground: 'linear-gradient(135deg, #e8ece8 0%, #d2ddd0 52%, #bccdbd 100%)',
      sections: [
        {
          title: 'Headwear',
          items: [
            { label: 'Vintage caps', to: '/products?c=headwear&style=vintage-caps' },
            { label: 'Dad caps', to: '/products?c=headwear&style=dad-caps' },
            { label: 'Beanies', to: '/products?c=headwear&style=beanies' },
            { label: 'Bucket hats', to: '/products?c=headwear&style=bucket-hats' },
            { label: 'Performance caps', to: '/products?c=headwear&style=performance' },
          ],
        },
        {
          title: 'Decoration',
          items: [
            { label: 'Embroidery', to: '/products?c=headwear&decoration=embroidery' },
            { label: 'Woven patches', to: '/products?c=headwear&decoration=patches' },
            { label: 'Tonal branding', to: '/products?c=headwear&decoration=tonal' },
          ],
        },
      ],
    },
  },
  {
    key: 'office',
    label: 'Office',
    to: '/products?c=office',
    menu: {
      featuredTitle: 'Desk objects people actually keep in rotation.',
      featuredDescription: 'Stationery, notebooks, and workday essentials selected for tasteful company stores and gifting programs.',
      featuredBackground: 'linear-gradient(135deg, #f1ede6 0%, #ddd1c2 56%, #d7c9ba 100%)',
      sections: [
        {
          title: 'Office',
          items: [
            { label: 'Notebooks', to: '/products?c=office&style=notebooks' },
            { label: 'Pens', to: '/products?c=office&style=pens' },
            { label: 'Desk accessories', to: '/products?c=office&style=desk-accessories' },
            { label: 'Tech organizers', to: '/products?c=office&style=tech-organizers' },
            { label: 'Calendars', to: '/products?c=office&style=calendars' },
          ],
        },
        {
          title: 'Collections',
          items: [
            { label: 'Executive gifts', to: '/products?c=office&collection=executive' },
            { label: 'Remote work', to: '/products?c=office&collection=remote' },
            { label: 'Onboarding desks', to: '/products?c=office&collection=onboarding' },
          ],
        },
      ],
    },
  },
  {
    key: 'drinkware',
    label: 'Drinkware',
    to: '/products?c=drinkware',
    menu: {
      featuredTitle: 'High-retention drinkware with room for subtle branding.',
      featuredDescription: 'From thermal bottles to espresso cups, built to travel between commute, desk, and gym.',
      featuredBackground: 'linear-gradient(135deg, #eef1f4 0%, #d9e3ee 54%, #c8d4df 100%)',
      sections: [
        {
          title: 'Drinkware',
          items: [
            { label: 'Water bottles', to: '/products?c=drinkware&style=water-bottles' },
            { label: 'Tumblers', to: '/products?c=drinkware&style=tumblers' },
            { label: 'Mugs', to: '/products?c=drinkware&style=mugs' },
            { label: 'Travel cups', to: '/products?c=drinkware&style=travel-cups' },
            { label: 'Glassware', to: '/products?c=drinkware&style=glassware' },
          ],
        },
        {
          title: 'Programs',
          items: [
            { label: 'Cafes and hospitality', to: '/products?c=drinkware&program=hospitality' },
            { label: 'Employee gifting', to: '/products?c=drinkware&program=employee' },
            { label: 'Event merch', to: '/products?c=drinkware&program=events' },
          ],
        },
      ],
    },
  },
  {
    key: 'home',
    label: 'Home',
    to: '/products?c=home',
    menu: {
      featuredTitle: 'Home pieces that make branded gifting feel elevated.',
      featuredDescription: 'Candles, throws, tableware, and home objects chosen for premium seasonal drops and client gifts.',
      featuredBackground: 'linear-gradient(135deg, #f4f1eb 0%, #e5ddd1 54%, #d7c9b9 100%)',
      sections: [
        {
          title: 'Home',
          items: [
            { label: 'Candles', to: '/products?c=home&style=candles' },
            { label: 'Tableware', to: '/products?c=home&style=tableware' },
            { label: 'Blankets', to: '/products?c=home&style=blankets' },
            { label: 'Kitchen objects', to: '/products?c=home&style=kitchen' },
            { label: 'Decor', to: '/products?c=home&style=decor' },
          ],
        },
        {
          title: 'Seasonal',
          items: [
            { label: 'Holiday gifts', to: '/products?c=home&season=holiday' },
            { label: 'Summer hosting', to: '/products?c=home&season=summer' },
            { label: 'Welcome home', to: '/products?c=home&season=welcome-home' },
          ],
        },
      ],
    },
  },
  {
    key: 'wellness',
    label: 'Wellness',
    to: '/products?c=wellness',
    menu: {
      featuredTitle: 'Wellness picks for teams who expect more than throwaway swag.',
      featuredDescription: 'Recovery tools, outdoor accessories, and routines built for retreats, perks, and active communities.',
      featuredBackground: 'linear-gradient(135deg, #ebf2ea 0%, #d7e4d4 54%, #bfd0c0 100%)',
      sections: [
        {
          title: 'Wellness',
          items: [
            { label: 'Yoga gear', to: '/products?c=wellness&style=yoga' },
            { label: 'Fitness accessories', to: '/products?c=wellness&style=fitness' },
            { label: 'Recovery tools', to: '/products?c=wellness&style=recovery' },
            { label: 'Outdoor essentials', to: '/products?c=wellness&style=outdoor' },
          ],
        },
        {
          title: 'Themes',
          items: [
            { label: 'Retreat kits', to: '/products?c=wellness&theme=retreat' },
            { label: 'Run clubs', to: '/products?c=wellness&theme=run-club' },
            { label: 'Mental reset', to: '/products?c=wellness&theme=reset' },
          ],
        },
      ],
    },
  },
  {
    key: 'others',
    label: 'Others',
    to: '/products?c=others',
    menu: {
      featuredTitle: 'Unexpected extras for the brands that want range.',
      featuredDescription: 'Games, travel goods, and niche objects that round out custom stores and curated campaigns.',
      featuredBackground: 'linear-gradient(135deg, #efeaf3 0%, #ded2e7 54%, #cfbddf 100%)',
      sections: [
        {
          title: 'Others',
          items: [
            { label: 'Travel gear', to: '/products?c=others&style=travel' },
            { label: 'Games', to: '/products?c=others&style=games' },
            { label: 'Pet accessories', to: '/products?c=others&style=pets' },
            { label: 'Limited runs', to: '/products?c=others&style=limited-runs' },
          ],
        },
        {
          title: 'Explore',
          items: [
            { label: 'Newest arrivals', to: '/products?c=others&sort=new' },
            { label: 'Bespoke sourcing', to: '/contact' },
            { label: 'Custom projects', to: '/integrations' },
          ],
        },
      ],
    },
  },
  {
    key: 'discover',
    label: 'Discover',
    to: '/products',
    menu: {
      featuredTitle: 'Explore curated edits, campaign ideas, and ready-to-build assortments.',
      featuredDescription: 'Use the merch studio like a reference shelf: browse what works by theme, season, and audience.',
      featuredBackground: 'linear-gradient(135deg, #f0ece9 0%, #e7dfd5 54%, #d9cfc4 100%)',
      sections: [
        {
          title: 'Discover',
          items: [
            { label: 'Best sellers', to: '/products?sort=bestsellers' },
            { label: 'New arrivals', to: '/products?sort=new' },
            { label: 'Made in Europe', to: '/products?origin=europe' },
            { label: 'B Corp picks', to: '/products?filter=bcorp' },
          ],
        },
        {
          title: 'Ideas',
          items: [
            { label: 'Welcome kits', to: '/products?idea=welcome-kits' },
            { label: 'Event collections', to: '/products?idea=events' },
            { label: 'Client gifts', to: '/products?idea=client-gifts' },
            { label: 'Seasonal edits', to: '/products?idea=seasonal' },
          ],
        },
      ],
    },
  },
  {
    key: 'brands',
    label: 'Brands',
    to: '/products',
    menu: {
      featuredTitle: 'Shop by label when the product identity matters as much as the logo.',
      featuredDescription: 'Browse premium brand partners and see which names align with your audience, budget, and finish level.',
      featuredBackground: 'linear-gradient(135deg, #ebebea 0%, #d9d9d5 54%, #ccccca 100%)',
      sections: [
        {
          title: 'Brands',
          items: [
            { label: 'Patagonia', to: '/products?brand=patagonia' },
            { label: 'Kinto', to: '/products?brand=kinto' },
            { label: 'Moleskine', to: '/products?brand=moleskine' },
            { label: 'Yeti', to: '/products?brand=yeti' },
          ],
        },
        {
          title: 'Shop paths',
          items: [
            { label: 'Premium apparel brands', to: '/products?group=apparel-brands' },
            { label: 'Drinkware partners', to: '/products?group=drinkware-brands' },
            { label: 'Office essentials labels', to: '/products?group=office-brands' },
          ],
        },
      ],
    },
  },
]
</script>
