/**
 * @file Shared editable emails section for entity edit dialogs
 * @module client/components/shared/EditableEmailsSection
 *
 * Copyright (c) 2025–present Ian Silverstone.
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';

import CollectionSectionHeader from './CollectionSectionHeader.jsx';
import EmailRow from './EmailRow.jsx';

export default function EditableEmailsSection({
  collection,
  emptyMessage = 'No emails',
  addLabel = 'Add Email',
  showLogin = false,
  loginDisabled = false,
}) {
  return (
    <>
      <Divider />
      <CollectionSectionHeader title="Emails" addLabel={addLabel} onAdd={collection.add} />
      {collection.indexedItems.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      )}
      {collection.indexedItems.map(({ item, index }) => (
        <EmailRow
          key={item.id || index}
          item={item}
          index={index}
          onUpdate={collection.update}
          onRemove={collection.remove}
          showLogin={showLogin}
          loginDisabled={loginDisabled}
        />
      ))}
    </>
  );
}
