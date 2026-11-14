
'use strict';

(() => {
  const root = document.getElementById('productsList');
  const addButton = document.getElementById('addProductButton');
  const formContainer = document.getElementById('productFormContainer');

  if (!root || !addButton || !formContainer) return;

  const make = (tag, value, className) => {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (className) node.className = className;
    return node;
  };

  const money = value => '₱' + Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  let loading = false;
  let saving = false;

  function getDb() {
    if (!window.DS_adminDb) {
      throw new Error('Admin connection unavailable. Refresh the page.');
    }
    return window.DS_adminDb;
  }

  async function ensureAdmin(db) {
    const { data: { user }, error: userError } = await db.auth.getUser();

    if (userError || !user) {
      throw new Error('Please sign in as an admin.');
    }

    const { data: allowed, error } = await db.rpc('is_admin');

    if (error || allowed !== true) {
      throw new Error('Admin access required.');
    }
  }

  async function loadProducts() {
    if (loading) return;

    loading = true;
    root.textContent = 'Loading products…';

    try {
      const db = getDb();
      await ensureAdmin(db);

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

      const list = make('div', undefined, 'ds-products-grid');

      for (const product of data) {
        const card = make('article', undefined, 'ds-product-card');
        const heading = make('strong', product.name);

        const detail = make(
          'span',
          `${money(product.price)} · ${product.category}`,
          'ds-product-detail'
        );

        const status = make(
          'span',
          product.is_active ? 'Active' : 'Inactive',
          'ds-product-status' + (product.is_active ? '' : ' inactive')
        );

        card.append(heading, detail, status);
        list.append(card);
      }

      root.append(list);

    } catch (error) {
      root.textContent = 'Could not load products: ' + error.message;
    } finally {
      loading = false;
    }
  }

  function closeForm() {
    formContainer.replaceChildren();
    formContainer.hidden = true;
    addButton.disabled = false;
  }

  function showForm() {
    if (!formContainer.hidden) {
      closeForm();
      return;
    }

    formContainer.replaceChildren();
    formContainer.hidden = false;

    const form = make('form', undefined, 'ds-product-form');
    const heading = make('h3', 'Add New Product');

    const nameLabel = make('label', 'Product name');
    const nameInput = document.createElement('input');

    nameInput.type = 'text';
    nameInput.maxLength = 80;
    nameInput.required = true;
    nameInput.placeholder = 'e.g. Vanilla Latte';
    nameLabel.append(nameInput);

    const priceLabel = make('label', 'Price (₱)');
    const priceInput = document.createElement('input');

    priceInput.type = 'number';
    priceInput.min = '0.01';
    priceInput.max = '99999.99';
    priceInput.step = '0.01';
    priceInput.required = true;
    priceInput.placeholder = 'e.g. 135';
    priceLabel.append(priceInput);

    const categoryLabel = make('label', 'Category');
    const categoryInput = document.createElement('select');

    for (const category of ['Coffee', 'Non-Coffee']) {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryInput.append(option);
    }

    categoryLabel.append(categoryInput);

    const actions = make('div', undefined, 'ds-product-form-actions');

    const saveButton = make('button', 'Save Product');
    saveButton.type = 'submit';

    const cancelButton = make('button', 'Cancel', 'ghost');
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', closeForm);

    actions.append(saveButton, cancelButton);

    const feedback = make('p', '', 'ds-product-feedback');
    feedback.setAttribute('role', 'status');

    form.append(
      heading,
      nameLabel,
      priceLabel,
      categoryLabel,
      actions,
      feedback
    );

    formContainer.append(form);
    nameInput.focus();

    form.addEventListener('submit', async event => {
      event.preventDefault();

      if (saving) return;

      const name = nameInput.value.trim().replace(/\s+/g, ' ');
      const price = Number(priceInput.value);
      const category = categoryInput.value;

      if (
        !name ||
        name.length > 80 ||
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 99999.99 ||
        Math.round(price * 100) !== price * 100 ||
        !['Coffee', 'Non-Coffee'].includes(category)
      ) {
        feedback.textContent = 'Enter a valid name, price, and category.';
        return;
      }

      saving = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      feedback.textContent = 'Saving product…';

      try {
        const db = getDb();
        await ensureAdmin(db);

        const { data: existing, error: lookupError } = await db
          .from('products')
          .select('id,name');

        if (lookupError) throw lookupError;

        if (
          (existing || []).some(
            item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase()
          )
        ) {
          throw new Error('A product with this name already exists.');
        }

        const { error } = await db.from('products').insert({
          name,
          price,
          category,
          is_active: true
        });

        if (error) throw error;

        closeForm();
        await loadProducts();

      } catch (error) {
        feedback.textContent = 'Could not save: ' + error.message;
      } finally {
        saving = false;
        saveButton.disabled = false;
        cancelButton.disabled = false;
      }
    });
  }

  addButton.addEventListener('click', showForm);

  const style = document.createElement('style');

  style.textContent = `
    #addProductButton {
      margin: 8px 0 18px;
    }

    .ds-products-grid {
      display: grid;
      gap: 9px;
    }

    .ds-product-card {
      background: #f9f3ea;
      border: 1px solid #ddcfc1;
      border-radius: 12px;
      padding: 13px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .ds-product-card strong {
      flex: 1 1 180px;
    }

    .ds-product-detail {
      color: #705f51;
      font-size: 13px;
    }

    .ds-product-status {
      background: #d9ebd9;
      color: #1e582c;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
    }

    .ds-product-status.inactive {
      background: #e9dbcd;
      color: #705f51;
    }

    .ds-product-form {
      background: #f9f3ea;
      border: 1px solid #ddcfc1;
      border-radius: 14px;
      padding: 18px;
      display: grid;
      gap: 12px;
      margin-bottom: 18px;
    }

    .ds-product-form h3 {
      margin: 0;
    }

    .ds-product-form-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ds-product-feedback {
      margin: 0;
      font-size: 13px;
    }

    #productFormContainer[hidden] {
      display: none;
    }
  `;

  document.head.append(style);
  loadProducts();
})();
