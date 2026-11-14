
'use strict';

(() => {
  const root = document.getElementById('productsList');
  const addButton = document.getElementById('addProductButton');
  const formContainer = document.getElementById('productFormContainer');

  if (!root || !addButton || !formContainer) return;

  const db = window.DS_adminDb;
  if (!db) {
    root.textContent = 'Admin connection unavailable.';
    return;
  }

  let products = [];
  let saving = false;

  const money = value => '₱' + Number(value).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  function element(tag, content, className) {
    const el = document.createElement(tag);
    if (content !== undefined) el.textContent = content;
    if (className) el.className = className;
    return el;
  }

  async function checkAdmin() {
    const { data: { user }, error: authError } =
      await db.auth.getUser();

    if (authError || !user) {
      throw new Error('Please sign in again.');
    }

    const { data, error } = await db.rpc('is_admin');

    if (error || data !== true) {
      throw new Error('Admin permission required.');
    }
  }

  async function loadProducts() {
    root.textContent = 'Loading products…';

    try {
      await checkAdmin();

      const { data, error } = await db
        .from('products')
        .select('id,name,price,category,is_active,oat_eligible')
        .order('name');

      if (error) throw error;

      products = data || [];
      renderProducts();
    } catch (error) {
      root.textContent = 'Could not load products: ' + error.message;
    }
  }

  function renderProducts() {
    root.replaceChildren();

    if (!products.length) {
      root.textContent = 'No products found.';
      return;
    }

    const list = element('div', undefined, 'ds-products-grid');

    for (const product of products) {
      const card = element('article', undefined, 'ds-product-card');
      const name = element('strong', product.name);

      const detail = element(
        'span',
        `${money(product.price)} · ${product.category}`,
        'ds-product-detail'
      );

      const oatStatus = element(
        'span',
        product.oat_eligible ? 'Oat Milk Available' : 'No Oat Milk',
        'ds-product-oat'
      );

      const status = element(
        'span',
        product.is_active ? 'Active' : 'Inactive',
        'ds-product-status' + (product.is_active ? '' : ' inactive')
      );

      const actions = element('div', undefined, 'ds-product-actions');

      const edit = element('button', 'Edit', 'ghost');
      edit.type = 'button';
      edit.onclick = () => showForm(product);

      const toggle = element(
        'button',
        product.is_active ? 'Deactivate' : 'Activate',
        'ghost'
      );
      toggle.type = 'button';
      toggle.onclick = () => changeAvailability(product, toggle);

      actions.append(edit, toggle);
      card.append(name, detail, oatStatus, status, actions);
      list.append(card);
    }

    root.append(list);
  }

  function closeForm() {
    formContainer.replaceChildren();
    formContainer.hidden = true;
  }

  function showForm(product = null) {
    if (saving) return;

    formContainer.replaceChildren();
    formContainer.hidden = false;

    const editing = !!product;
    const form = element('form', undefined, 'ds-product-form');

    const heading = element(
      'h3',
      editing ? 'Edit Product' : 'Add New Product'
    );

    function field(labelText, type, value = '') {
      const label = element('label', labelText);
      const input = document.createElement('input');

      input.type = type;
      input.value = value;
      input.required = true;

      label.append(input);
      return { label, input };
    }

    const name = field(
      'Product name',
      'text',
      product?.name || ''
    );
    name.input.maxLength = 80;

    const price = field(
      'Price (₱)',
      'number',
      product?.price || ''
    );
    price.input.min = '0.01';
    price.input.max = '99999.99';
    price.input.step = '0.01';

    const categoryLabel = element('label', 'Category');
    const category = document.createElement('select');

    for (const value of ['Coffee', 'Non-Coffee']) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      category.append(option);
    }

    category.value = product?.category || 'Coffee';
    categoryLabel.append(category);

    const oatLabel = element('label', undefined, 'ds-product-oat-label');
    const oatCheckbox = document.createElement('input');
    oatCheckbox.type = 'checkbox';
    oatCheckbox.checked = product?.oat_eligible === true;
    oatLabel.append(oatCheckbox, document.createTextNode(' Oat Milk Eligible (+₱30)'));

    const actions = element('div', undefined, 'ds-product-form-actions');

    const save = element(
      'button',
      editing ? 'Save Changes' : 'Save Product'
    );
    save.type = 'submit';

    const cancel = element('button', 'Cancel', 'ghost');
    cancel.type = 'button';
    cancel.onclick = closeForm;

    const feedback = element('p', '', 'ds-product-feedback');
    feedback.setAttribute('role', 'status');

    actions.append(save, cancel);
    form.append(
      heading,
      name.label,
      price.label,
      categoryLabel,
      oatLabel,
      actions,
      feedback
    );

    formContainer.append(form);
    name.input.focus();

    form.onsubmit = async event => {
      event.preventDefault();
      if (saving) return;

      const newName = name.input.value.trim().replace(/\s+/g, ' ');
      const rawPrice = price.input.value.trim();
      const newPrice = Number(rawPrice);
      const newCategory = category.value;

      if (
        !newName ||
        newName.length > 80 ||
        !/^\d+(\.\d{1,2})?$/.test(rawPrice) ||
        !Number.isFinite(newPrice) ||
        newPrice <= 0 ||
        newPrice > 99999.99 ||
        !['Coffee', 'Non-Coffee'].includes(newCategory)
      ) {
        feedback.textContent = 'Enter valid product details.';
        return;
      }

      saving = true;
      save.disabled = true;
      cancel.disabled = true;
      feedback.textContent = 'Saving…';

      try {
        await checkAdmin();

        const duplicate = products.some(p =>
          p.id !== product?.id &&
          p.name.trim().toLowerCase() === newName.toLowerCase()
        );

        if (duplicate) {
          throw new Error('Product name already exists.');
        }

        const values = {
          name: newName,
          price: newPrice,
          category: newCategory,
          oat_eligible: oatCheckbox.checked,
          updated_at: new Date().toISOString()
        };

        let result;

        if (editing) {
          result = await db
            .from('products')
            .update(values)
            .eq('id', product.id)
            .select('id');
        } else {
          result = await db
            .from('products')
            .insert({
              ...values,
              is_active: true
            })
            .select('id');
        }

        if (result.error) throw result.error;
        if (!result.data?.length) {
          throw new Error('No product was saved. Check permissions.');
        }

        closeForm();
        await loadProducts();
      } catch (error) {
        feedback.textContent = 'Save failed: ' + error.message;
      } finally {
        saving = false;
        save.disabled = false;
        cancel.disabled = false;
      }
    };
  }

  async function changeAvailability(product, button) {
    if (saving) return;

    const next = !product.is_active;
    const action = next ? 'Activate' : 'Deactivate';

    if (!confirm(`${action} "${product.name}"?`)) return;

    saving = true;
    button.disabled = true;

    try {
      await checkAdmin();

      const { data, error } = await db
        .from('products')
        .update({
          is_active: next,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id)
        .eq('is_active', product.is_active)
        .select('id');

      if (error) throw error;

      if (!data?.length) {
        throw new Error('Product was not updated. Refresh and retry.');
      }

      await loadProducts();
    } catch (error) {
      alert('Update failed: ' + error.message);
    } finally {
      saving = false;
      button.disabled = false;
    }
  }

  addButton.onclick = () => {
    if (formContainer.hidden) showForm();
    else closeForm();
  };

  const style = document.createElement('style');

  style.textContent = `
    #addProductButton { margin: 8px 0 18px; }

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

    .ds-product-card strong { flex: 1 1 160px; }

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

    .ds-product-oat {
      color: #705f51;
      font-size: 12px;
    }

    .ds-product-oat-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .ds-product-oat-label input {
      width: 17px;
      height: 17px;
      accent-color: #65452c;
    }

    .ds-product-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .ds-product-actions button {
      padding: 7px 11px;
      font-size: 12px;
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

    .ds-product-form h3 { margin: 0; }

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
