'use strict';

(async () => {
  const root = document.getElementById('productsList');
  if (!root) return;

  const waitForClient = async () => {
    for (let i = 0; i < 40; i++) {
      if (window.DS_adminDb) return window.DS_adminDb;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Admin connection unavailable.');
  };

  root.textContent = 'Loading products…';

  try {
    const db = await waitForClient();

    const { data, error } = await db
      .from('products')
      .select('id,name,price,category,is_active')
      .order('name');

    if (error) throw error;

    root.replaceChildren();

    if (!data?.length) {
      root.textContent = 'No products found.';
      return;
    }

    for (const product of data) {
      const card = document.createElement('article');
      card.className = 'ordercard';

      const title = document.createElement('h3');
      title.textContent = product.name;

      const details = document.createElement('p');
      details.textContent =
        `₱${Number(product.price).toFixed(2)} · ${product.category}`;

      const status = document.createElement('strong');
      status.textContent = product.is_active
        ? 'Active'
        : 'Inactive';

      card.append(title, details, status);
      root.append(card);
    }
  } catch (error) {
    root.textContent = 'Could not load products: ' + error.message;
  }
})();
