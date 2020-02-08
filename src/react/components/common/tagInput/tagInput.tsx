// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import React, { KeyboardEvent, RefObject } from "react";
import ReactDOM from "react-dom";
import Align from "rc-align";
import { randomIntInRange } from "../../../../common/utils";
import { IRegion, ITag, ILabel, FieldType, FieldFormat } from "../../../../models/applicationState";
import { ColorPicker } from "../colorPicker";
import "./tagInput.scss";
import "../condensedList/condensedList.scss";
import TagInputItem, { ITagInputItemProps, ITagClickProps } from "./tagInputItem";
import TagInputToolbar from "./tagInputToolbar";
import { toast } from "react-toastify";
import { strings } from "../../../../common/strings";
import TagTypeFormat from "./tagTypeFormat";
// tslint:disable-next-line:no-var-requires
const tagColors = require("../../common/tagColors.json");

export interface ITagInputProps {
    /** Current list of tags */
    tags: ITag[];
    /** Function called on tags change */
    onChange: (tags: ITag[]) => void;
    /** Currently selected regions in canvas */
    selectedRegions?: IRegion[];
    /** The labels in the canvas */
    labels: ILabel[];
    /** Tags that are currently locked for editing experience */
    lockedTags?: string[];
    /** Updates to locked tags */
    onLockedTagsChange?: (locked: string[]) => void;
    /** Place holder for input text box */
    placeHolder?: string;
    /** Function to call on clicking individual tag */
    onTagClick?: (tag: ITag) => void;
    /** Function to call on clicking individual tag while holding CTRL key */
    onCtrlTagClick?: (tag: ITag) => void;
    /** Function to call when tag is renamed */
    onTagRenamed?: (oldTag: ITag, newTag: ITag) => void;
    /** Function to call when tag is deleted */
    onTagDeleted?: (tagName: string) => void;
    /** Always show tag input box */
    showTagInputBox?: boolean;
    /** Always show tag search box */
    showSearchBox?: boolean;
    /** Callback function for TagInputItemLabel mouse enter */
    onLabelEnter: (label: ILabel) => void;
    /** Callback function for TagInputItemLabel mouse leave */
    onLabelLeave: (label: ILabel) => void;
    /** Function to handle tag change */
    onTagChanged?: (oldTag: ITag, newTag: ITag) => void;
}

export interface ITagInputState {
    tags: ITag[];
    clickedColor: boolean;
    clickedDropDown: boolean;
    showColorPicker: boolean;
    showDropDown: boolean;
    addTags: boolean;
    searchTags: boolean;
    searchQuery: string;
    selectedTag: ITag;
    editingTag: ITag;
    colorPortalElement: Element;
    fieldPortalElement: Element;
    editingTagNode: Element;
}

function defaultDOMNode(): Element {
    return document.createElement("div");
}

export class TagInput extends React.Component<ITagInputProps, ITagInputState> {

    public state: ITagInputState = {
        tags: this.props.tags || [],
        clickedColor: false,
        clickedDropDown: false,
        showColorPicker: false,
        showDropDown: false,
        addTags: this.props.showTagInputBox,
        searchTags: this.props.showSearchBox,
        searchQuery: "",
        selectedTag: null,
        editingTag: null,
        editingTagNode: null,
        colorPortalElement: defaultDOMNode(),
        fieldPortalElement: defaultDOMNode(),
    };

    private tagItemRefs: Map<string, TagInputItem> = new Map<string, TagInputItem>();
    private portalDiv = document.createElement("div");

    private inputRef: RefObject<HTMLInputElement>;

    constructor(props) {
        super(props);
        this.inputRef = React.createRef();
    }

    public render() {
        return (
            <div className="tag-input condensed-list">
                <h6 className="condensed-list-header tag-input-header bg-darker-2 p-2">
                    <span
                        className="condensed-list-title tag-input-title"
                    >Tags</span>
                    <TagInputToolbar
                        selectedTag={this.state.selectedTag}
                        onAddTags={() => this.setState({ addTags: !this.state.addTags })}
                        onSearchTags={() => this.setState({
                            searchTags: !this.state.searchTags,
                            searchQuery: "",
                        })}
                        onEditTag={this.onEditTag}
                        onLockTag={this.onLockTag}
                        onDelete={this.deleteTag}
                        onReorder={this.onReOrder}
                    />
                </h6>
                <div className="condensed-list-body">
                    {
                        this.state.searchTags &&
                        <div className="tag-input-text-input-row search-input">
                            <input
                                className="tag-search-box"
                                type="text"
                                onKeyDown={this.onSearchKeyDown}
                                onChange={(e) => this.setState({ searchQuery: e.target.value })}
                                placeholder="Search tags"
                                autoFocus={true}
                            />
                            <i className="ms-Icon ms-Icon--Search" />
                        </div>
                    }
                    {this.getColorPickerPortal()}
                    {this.getTagFieldPortal()}
                    <div className="tag-input-items">
                        {this.renderTagItems()}
                    </div>
                    {
                        this.state.addTags &&
                        <div className="tag-input-text-input-row new-tag-input">
                            <input
                                className="tag-input-box"
                                type="text"
                                onKeyDown={this.onAddTagKeyDown}
                                // Add mouse event
                                onBlur={this.onAddTagWithBlur}
                                placeholder="Add new tag"
                                autoFocus={true}
                                ref={this.inputRef}
                            />
                            <i className="ms-Icon ms-Icon--Tag" />
                        </div>
                    }
                </div>
            </div>
        );
    }

    public componentDidMount() {
        document.body.appendChild(this.portalDiv);
        this.setState({
            colorPortalElement: ReactDOM.findDOMNode(this.portalDiv) as Element,
            fieldPortalElement: ReactDOM.findDOMNode(this.portalDiv) as Element,
        });
    }

    public componentWillUnmount() {
        document.body.removeChild(this.portalDiv);
    }

    public componentDidUpdate(prevProps: ITagInputProps) {
        if (prevProps.tags !== this.props.tags) {
            this.setState({
                tags: this.props.tags,
            });
        }

        if (prevProps.selectedRegions !== this.props.selectedRegions && this.props.selectedRegions.length > 0) {
            this.setState({
                selectedTag: null,
            });
        }
    }

    public triggerNewTagBlur() {
        if (this.inputRef.current) {
            this.inputRef.current.blur();
        }
    }

    private getTagNode = (tag: ITag): Element => {
        const itemRef = tag ? this.tagItemRefs.get(tag.name) : null;
        return (itemRef ? ReactDOM.findDOMNode(itemRef) : defaultDOMNode()) as Element;
    }

    private onEditTag = (tag: ITag) => {
        const { editingTag } = this.state;
        const newEditingTag = (editingTag && this.isNameEqual(editingTag, tag)) ? null : tag;
        this.setState({
            editingTag: newEditingTag,
            editingTagNode: this.getTagNode(newEditingTag),
        });
        if (this.state.clickedColor) {
            this.setState({
                showColorPicker: !this.state.showColorPicker,
            });
        }
    }

    private onLockTag = (tag: ITag) => {
        if (!tag) {
            return;
        }
        let lockedTags = [...this.props.lockedTags];
        if (lockedTags.find((str) => this.isNameEqualTo(tag, str))) {
            lockedTags = lockedTags.filter((str) => !this.isNameEqualTo(tag, str));
        } else {
            lockedTags.push(tag.name);
        }
        this.props.onLockedTagsChange(lockedTags);
    }

    private onReOrder = (tag: ITag, displacement: number) => {
        if (!tag) {
            return;
        }
        const tags = [...this.state.tags];
        const currentIndex = tags.indexOf(tag);
        const newIndex = currentIndex + displacement;
        if (newIndex < 0 || newIndex >= tags.length) {
            return;
        }
        tags.splice(currentIndex, 1);
        tags.splice(newIndex, 0, tag);
        this.setState({
            tags,
        }, () => this.props.onChange(tags));
    }

    private handleColorChange = (color: string) => {
        const tag = this.state.editingTag;
        const tags = this.state.tags.map((t) => {
            return (this.isNameEqual(t, tag)) ? {
                name: t.name,
                color,
                type: t.type,
                format: t.format,
            } : t;
        });
        this.setState({
            tags,
            editingTag: null,
            showColorPicker: false,
        }, () => this.props.onChange(tags));
    }

    private addTag = (tag: ITag) => {
        try {
            this.validateTagLength(tag);
            this.validateTagUniqness(tag, this.state.tags);
        } catch (error) {
            toast.warn(error.toString());
            return;
        }

        const tags = [...this.state.tags, tag];
        this.setState({
            tags,
        }, () => this.props.onChange(tags));
    }

    private updateTag = (tag: ITag, newTag: ITag) => {
        if ((this.isNameEqual(tag, newTag)) && tag.color === newTag.color) {
            return;
        }

        try {
            const tagsWithoutOldTag = this.state.tags.filter((elem) => !this.isNameEqual(elem, tag));
            this.validateTagLength(newTag);
            this.validateTagUniqness(newTag, tagsWithoutOldTag);
        } catch (error) {
            toast.warn(error.toString());
            return;
        }

        const nameChanged = !this.isNameEqual(tag, newTag);
        if (nameChanged && this.props.onTagRenamed) {
           this.props.onTagRenamed(tag, newTag);
           return;
        }

        const tags = this.state.tags.map((t) => {
            return (this.isNameEqual(t, tag)) ? newTag : t;
        });
        this.setState({
            tags,
            editingTag: null,
            selectedTag: newTag,
        }, () => {
            this.props.onChange(tags);
        });
    }

    private deleteTag = (tag: ITag) => {
        if (!tag) {
            return;
        }
        const index = this.state.tags.indexOf(tag);
        const tags = this.state.tags.filter((t) => !this.isNameEqual(t, tag));

        this.setState({
            tags,
            selectedTag: this.getNewSelectedTag(tags, index),
        }, () => this.props.onChange(tags));
        this.props.onTagDeleted(tag.name);
    }

    private getColorPickerPortal = () => {
        return (
            <div>
                {
                    ReactDOM.createPortal(
                        <Align align={this.getColorAlignConfig()} target={this.getEditingTagNode}>
                            <div className="tag-input-potal">
                                {
                                    this.state.showColorPicker &&
                                    <ColorPicker
                                        color={this.state.editingTag && this.state.editingTag.color}
                                        colors={tagColors}
                                        onEditColor={this.handleColorChange}
                                        show={this.state.showColorPicker}
                                    />
                                }
                            </div>
                        </Align>
                        , this.state.colorPortalElement)
                }
            </div>
        );
    }

    private getTagFieldPortal = () => {
        return (
            <div>
                {
                    ReactDOM.createPortal(
                        <Align align={this.getFieldAlignConfig()} target={this.getEditingTagNameNode}>
                            <div className="tag-input-potal" style = {{overflow: "hidden"}}>
                                {
                                    this.state.showDropDown &&
                                    <TagTypeFormat
                                    key={this.state.editingTag.name}
                                    tag={this.state.editingTag}
                                    onChange={this.props.onTagChanged}
                                    />
                                }
                            </div>
                        </Align>
                        , this.state.fieldPortalElement)}
            </div>
        );
    }

    private getColorAlignConfig = () => {
        const coords = this.getEditingTagCoords();
        const isNearBottom = coords && coords.top > (window.innerHeight / 2);
        const alignCorner = isNearBottom ? "b" : "t";
        const verticalOffset = isNearBottom ? 6 : -6;
        return {
            // Align top right of source node (color picker) with top left of target node (tag row)
            points: [`${alignCorner}r`, `${alignCorner}l`],
            // Offset source node by 0px in x and 6px in y
            offset: [0, verticalOffset],
            // Offset targetNode by 30% of target node width in x and 40% of target node height
            // targetOffset: ["30%", "40%"],
            // Auto adjust position when source node is overflowed
            // overflow: {adjustX: true, adjustY: true}
        };
    }

    private getFieldAlignConfig = () => {
        return {
            // Align top right of source node (dropdown) with top left of target node (tag name row)
            points: ["tr", "br"],
            // Offset source node by 6px in x and 3px in y
            offset: [6, 3],
            // Offset targetNode by 30% of target node width in x and 40% of target node height
            // targetOffset: ["30%", "40%"],
            // Auto adjust position when source node is overflowed
            overflow: {adjustX: true, adjustY: true},
        };
    }

    private getEditingTagCoords = () => {
        const node = this.state.editingTagNode;
        return (node) ? node.getBoundingClientRect() : null;
    }

    private getEditingTagNode = () => {
        return this.state.editingTagNode || document;
    }

    private getEditingTagNameNode = () => {
        return TagInputItem.getNameNode(this.state.editingTagNode) || document;
    }

    private renderTagItems = () => {
        let props = this.createTagItemProps();
        const query = this.state.searchQuery;
        this.tagItemRefs.clear();

        if (query.length) {
            props = props.filter((prop) => prop.tag.name.toLowerCase().includes(query.toLowerCase()));
        }

        return props.map((prop) =>
            <TagInputItem
                key={prop.tag.name}
                labels={this.setTagLabels(prop.tag.name)}
                ref={(item) => this.setTagItemRef(item, prop.tag)}
                onLabelEnter={this.props.onLabelEnter}
                onLabelLeave={this.props.onLabelLeave}
                onTagChanged={this.props.onTagChanged}
                onCallDropDown = {this.handleTagItemDropDown}
                {...prop}
            />);
    }

    private handleTagItemDropDown = () => {
        this.setState((prevState) => ({
            showDropDown: !prevState.showDropDown,
        }));
    }

    private setTagItemRef = (item: TagInputItem, tag: ITag) => {
        this.tagItemRefs.set(tag.name, item);
        return item;
    }

    private setTagLabels = (key: string): ILabel[] => {
        return this.props.labels.filter((label) => label.label === key);
    }

    private createTagItemProps = (): ITagInputItemProps[] => {
        const tags = this.state.tags;
        const selectedRegionTagSet = this.getSelectedRegionTagSet();

        return tags.map((tag) => (
            {
                tag,
                index: tags.findIndex((t) => this.isNameEqual(t, tag)),
                isLocked: this.props.lockedTags &&
                    this.props.lockedTags.findIndex((str) => this.isNameEqualTo(tag, str)) > -1,
                isBeingEdited: this.state.editingTag && this.isNameEqual(this.state.editingTag, tag),
                isSelected: this.state.selectedTag && this.isNameEqual(this.state.selectedTag, tag),
                appliedToSelectedRegions: selectedRegionTagSet.has(tag.name),
                onClick: this.handleClick,
                onChange: this.updateTag,
            } as ITagInputItemProps
        ));
    }

    private getSelectedRegionTagSet = (): Set<string> => {
        const result = new Set<string>();
        if (this.props.selectedRegions) {
            for (const region of this.props.selectedRegions) {
                for (const tag of region.tags) {
                    result.add(tag);
                }
            }
        }
        return result;
    }

    private onAltClick = (tag: ITag) => {
        const { editingTag } = this.state;
        const newEditingTag = this.state.showDropDown && editingTag && this.isNameEqual(editingTag, tag) ? null : tag;
        this.setState({
            editingTag: newEditingTag,
            editingTagNode: this.getTagNode(newEditingTag),
        });
    }

    private onSingleClick = (tag: ITag, clickedColor: boolean, clickedDropDown: boolean) => {
        const { editingTag } = this.state;
        const newEditingTag = this.state.showDropDown && editingTag && this.isNameEqual(editingTag, tag) ? null : tag;
        this.setState({
            editingTag: newEditingTag,
            editingTagNode: this.getTagNode(newEditingTag),
            clickedColor,
            clickedDropDown,
            showColorPicker: !this.state.showColorPicker && clickedColor,
            showDropDown: !this.state.showDropDown && clickedDropDown,
        });
    }

    private handleClick = (tag: ITag, props: ITagClickProps) => {
        // Lock tags
        if (props.ctrlKey && this.props.onCtrlTagClick) {
            this.props.onCtrlTagClick(tag);
            this.setState({ clickedColor: props.clickedColor, clickedDropDown: props.clickedDropDown });
        } else if (props.altKey) { // Edit tag
            this.onAltClick(tag);
        } else if (props.keyClick) {
            this.onSingleClick(tag, props.clickedColor, props.clickedDropDown);
        } else { // Select tag
            const { editingTag, selectedTag } = this.state;
            const inEditMode = editingTag && this.isNameEqual(editingTag, tag);
            const alreadySelected = selectedTag && this.isNameEqual(selectedTag, tag);
            const newEditingTag = inEditMode ? null : editingTag;

            this.setState({
                editingTag: newEditingTag,
                editingTagNode: this.getTagNode(newEditingTag),
                selectedTag: (alreadySelected && !inEditMode) ? null : tag,
                clickedColor: props.clickedColor,
                clickedDropDown: props.clickedDropDown,
                showColorPicker: false,
                showDropDown: false,
            });

            // Only fire click event if a region is selected
            if (this.props.selectedRegions &&
                this.props.selectedRegions.length > 0 &&
                this.props.onTagClick &&
                !inEditMode) {
                this.props.onTagClick(tag);
            }
        }
    }

    private getNewSelectedTag = (tags: ITag[], previouIndex: number): ITag => {
        return (tags.length) ? tags[Math.min(tags.length - 1, previouIndex)] : null;
    }

    private onSearchKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            this.setState({
                searchTags: false,
            });
        }
    }

    private onAddTagKeyDown = (event) => {
        // Add handle mouse event functionality
        if (event.key === "Enter") {
            // validate and add
            this.creatTagInput(event.target.value.trim());
            event.target.value = "";
        }
        if (event.key === "Escape") {
            this.setState({
                addTags: false,
            });
        }
    }

    private onAddTagWithBlur = (event: any) => {
        if (event.target.value) {
            this.creatTagInput(event.target.value.trim());
            event.target.value = "";
        }
    }

    private creatTagInput = (value: any) => {
        const newTag: ITag = {
                name: value,
                color: this.getNextColor(),
                type: FieldType.String,
                format: FieldFormat.NotSpecified,
        };
        if (newTag.name.length && ![...this.state.tags, newTag].containsDuplicates((t) => t.name)) {
            this.addTag(newTag);
        } else if (!newTag.name.length) {
            toast.warn(strings.tags.warnings.emptyName);
        } else {
            toast.warn(strings.tags.warnings.existingName);
        }
    }

    private getNextColor = () => {
        const tags = this.state.tags;

        for (const color of tagColors) {
            let vacancy = true;
            for (const tag of tags) {
                if (color.toLowerCase() === tag.color.toLowerCase()) {
                    vacancy = false;
                    break;
                }
            }
            if (vacancy) {
                return color;
            }
        }

        return tagColors[randomIntInRange(0, tagColors.length - 1)];
    }

    private validateTagLength = (tag: ITag) => {
        if (!tag.name.trim().length) {
            throw new Error(strings.tags.warnings.emptyName);
        }
        if (tag.name.length >= 128) {
            throw new Error("Tag name is too long (>= 128).");
        }
    }

    private validateTagUniqness = (tag: ITag, tags: ITag[]) => {
        if (tags.some((t) => this.isNameEqual(t, tag))) {
            throw new Error(strings.tags.warnings.existingName);
        }
    }

    private isNameEqual = (t: ITag, u: ITag) => {
        return t.name.trim().toLocaleLowerCase() === u.name.trim().toLocaleLowerCase();
    }
    private isNameEqualTo = (tag: ITag, str: string) => {
        return tag.name.trim().toLocaleLowerCase() === str.trim().toLocaleLowerCase();
    }
}