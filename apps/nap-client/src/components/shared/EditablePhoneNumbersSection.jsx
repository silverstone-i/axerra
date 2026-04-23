/**
 * @file Shared editable phone numbers section for entity edit dialogs
 * @module nap-client/components/shared/EditablePhoneNumbersSection
 *
 * Copyright (c) 2025 – present Vimber LLC. All rights reserved.
 */

import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import CollectionSectionHeader from './CollectionSectionHeader.jsx';
import PhoneRow from './PhoneRow.jsx';

export default function EditablePhoneNumbersSection({
  collection,
  emptyMessage = 'No phone numbers',
  addLabel = 'Add Phone',
}) {
  return (
    <>
      <Divider />
      <CollectionSectionHeader title="Phone Numbers" addLabel={addLabel} onAdd={collection.add} />
      {collection.indexedItems.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      )}
      {collection.indexedItems.map(({ item, index }) => (
        <PhoneRow key={item.id || index} item={item} index={index} onUpdate={collection.update} onRemove={collection.remove} />
      ))}
    </>
  );
}
