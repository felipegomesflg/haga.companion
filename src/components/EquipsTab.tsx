import type { BuildItem } from '../types/build'
import { useI18n } from '../hooks/useI18n'
import type { DraftEquipPage } from '../lib/equipPages'
import { EditablePageBar } from './EditablePageBar'
import { EquipmentPaperdoll } from './EquipmentPaperdoll'
import type { EquipmentSlotId } from '../lib/equipmentSlots'

interface Props {
  pages: DraftEquipPage[]
  items: BuildItem[]
  autoEditPageId?: string | null
  onAutoEditPageDone?: () => void
  onSelectPage: (pageId: string) => void
  onAddPage: () => void
  onRenamePage: (pageId: string, title: string) => void
  onDeletePage: (pageId: string) => void
  onEditSlot: (slotId: EquipmentSlotId, item: BuildItem | null) => void
}

export function EquipsTab({
  pages,
  items,
  autoEditPageId,
  onAutoEditPageDone,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onEditSlot,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="space-y-4 text-sm">
      <EditablePageBar
        pages={pages}
        autoEditPageId={autoEditPageId}
        onAutoEditDone={onAutoEditPageDone}
        onSelectPage={onSelectPage}
        onAddPage={onAddPage}
        onRenamePage={onRenamePage}
        onDeletePage={onDeletePage}
        ariaLabel="Equipment pages"
        labels={{
          addPage: t.build.equips.addPage,
          deletePage: t.common.delete,
          activeHint: t.build.equips.activePageHint,
          deleteConfirm: t.build.equips.deletePageConfirm,
          renameTabHint: t.build.gems.renameTabHint,
        }}
      />

      <p className="text-center text-xs text-slate-500">{t.build.equips.paperdollHint}</p>

      <EquipmentPaperdoll items={items} onEditSlot={onEditSlot} />
    </div>
  )
}
