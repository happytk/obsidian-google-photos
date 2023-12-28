import { ItemView, WorkspaceLeaf, moment } from 'obsidian';
import MyPlugin, {VIEW_TYPE} from './main';
import { GridView } from './renderer'
import { dateToGoogleDateFilter, GooglePhotosDateFilter } from 'photosApi'


export class DailyPhotosView extends ItemView {
    // vueApp: App;
    plugin: MyPlugin;
    gridView: GridView;
    photoDate: string | undefined;
    container: Element;
    googlePhotoMoment: moment.Moment | undefined;

    constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
        super(leaf);
        this.plugin = plugin;

		// rerender at midnight
		this.registerInterval(
			window.setInterval(
				() => {
                    // console.log(this.photoDate, this.plugin.currentFile)
                    if (this.googlePhotoMoment?.format('YYYY-MM-DD') !== this.plugin.googlePhotoMoment?.format('YYYY-MM-DD')) {
                        this.googlePhotoMoment = this.plugin.googlePhotoMoment;
                        this.updateView();
                    }
				},
				1700,
			),
		);
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Daily Google Photos";
    }

    getIcon(): string {
        return "camera";
    }

    async insertImageIntoEditor(event: MouseEvent) {
        console.log(event)
    }

    async onOpen(this: DailyPhotosView) {
        this.container = this.containerEl.children[1];
        this.container.empty();
        this.gridView = new GridView({
            scrollEl: this.containerEl,
            plugin: this.plugin,
            onThumbnailClick: event => this.insertImageIntoEditor(event)
        })
        // Attach the grid view to the modal
        this.container.appendChild(this.gridView.containerEl)
    }

    // isDailyNotesEnabled() {
    //     const dailyNotesPlugin = this.app.internalPlugins.plugins["daily-notes"];
    //     const dailyNotesEnabled = dailyNotesPlugin && dailyNotesPlugin.enabled;
    
    //     const periodicNotesPlugin = this.app.plugins.getPlugin("periodic-notes");
    //     const periodicNotesEnabled =
    //       periodicNotesPlugin && periodicNotesPlugin.settings?.daily?.enabled;
    
    //     return dailyNotesEnabled || periodicNotesEnabled;
    // }

    async updateView() {
        // let { folder, format } = getDailyNoteSettings();
        // console.log(format, this.plugin.currentFilePath)

        // if (!this.isDailyNotesEnabled()) return;
        // if (!this.plugin.currentFile) return;
        // if (!this.plugin.currentFilePath) return;
        // if (!this.plugin.currentFilePath.endsWith('.md')) return;

        // let filePathWithoutExt = this.plugin.currentFilePath.substring(0, this.plugin.currentFilePath.length - 3);
        // if (folder) {
        //     console.log(folder);
        //     if (!filePathWithoutExt.startsWith(folder)) return;
        //     console.log(filePathWithoutExt.substring(folder.length + 1), format);
        //     if (!moment(filePathWithoutExt.substring(folder.length + 1), format, true).isValid()) return;
        // }
        // else {
        //     if (!moment(filePathWithoutExt, format, true).isValid()) return;
        // }
        // console.log('passed!')

        const date = this.googlePhotoMoment?.format('YYYY-MM-DD')
        if (date === 'Invalid date') {
            this.gridView.resetGrid()
            this.gridView.setTitle("No date found")
            this.gridView.spinner.style.display = 'none'
            return;
        }

        const xDaysBeforeDate = moment(date).subtract(0, 'days')
        const xDaysAfterDate = moment(date).add(0, 'days')
        const dateFilter: GooglePhotosDateFilter = {
            ranges: [{
                startDate: dateToGoogleDateFilter(xDaysBeforeDate),
                endDate: dateToGoogleDateFilter(xDaysAfterDate)
            }]
        } as object
        this.gridView.resetGrid()
        this.gridView.setTitle(date ? date : "No date found")
        this.gridView.setSearchParams({
            filters: {
                dateFilter
            },
            orderBy: "MediaMetadata.creation_time"
        })
        this.gridView.getThumbnails().then()
    }

    async onClose() {
        this.gridView?.destroy()
    }
    onunload(): void {
    }
}