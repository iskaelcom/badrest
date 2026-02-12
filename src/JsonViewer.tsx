import { useState } from 'react';

interface JsonViewerProps {
    data: any;
    name?: string;
    isLast?: boolean;
    depth?: number;
}

export function JsonViewer({ data, name, isLast = false, depth = 0 }: JsonViewerProps) {
    const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels

    // Handle null and undefined
    if (data === null || data === undefined) {
        return (
            <div className="json-line">
                <span className="json-toggle-placeholder">  </span>
                {name && (
                    <>
                        <span className="json-key">"{name}"</span>
                        <span className="json-colon">: </span>
                    </>
                )}
                <span className="json-null">{data === null ? 'null' : 'undefined'}</span>
                {!isLast && <span className="json-comma">,</span>}
            </div>
        );
    }

    const dataType = Array.isArray(data) ? 'array' : typeof data;
    const isExpandable = (dataType === 'object' || dataType === 'array') && data !== null;
    const isEmpty = isExpandable && Object.keys(data).length === 0;

    const toggleExpand = () => {
        if (isExpandable && !isEmpty) {
            setIsExpanded(!isExpanded);
        }
    };

    const renderValue = (value: any): React.JSX.Element => {
        const type = typeof value;

        if (value === null) {
            return <span className="json-null">null</span>;
        }

        if (type === 'boolean') {
            return <span className="json-boolean">{String(value)}</span>;
        }

        if (type === 'number') {
            return <span className="json-number">{value}</span>;
        }

        if (type === 'string') {
            return <span className="json-string">"{value}"</span>;
        }

        return <span>{String(value)}</span>;
    };

    const renderKey = () => {
        if (!name) return null;
        return (
            <>
                <span className="json-key">"{name}"</span>
                <span className="json-colon">: </span>
            </>
        );
    };

    const renderToggle = () => {
        if (!isExpandable || isEmpty) return <span className="json-toggle-placeholder">  </span>;

        return (
            <span className="json-toggle" onClick={toggleExpand}>
                {isExpanded ? '▼' : '▶'}
            </span>
        );
    };

    const renderContent = () => {
        if (!isExpandable) {
            return (
                <div className="json-line">
                    {renderToggle()}
                    {renderKey()}
                    {renderValue(data)}
                    {!isLast && <span className="json-comma">,</span>}
                </div>
            );
        }

        const isArray = Array.isArray(data);
        const openBracket = isArray ? '[' : '{';
        const closeBracket = isArray ? ']' : '}';
        const entries = isArray
            ? data.map((item, index) => [index, item])
            : Object.entries(data);

        if (isEmpty) {
            return (
                <div className="json-line">
                    {renderToggle()}
                    {renderKey()}
                    <span className="json-bracket">{openBracket}{closeBracket}</span>
                    {!isLast && <span className="json-comma">,</span>}
                </div>
            );
        }

        return (
            <div className="json-object">
                <div className="json-line">
                    {renderToggle()}
                    {renderKey()}
                    <span className="json-bracket">{openBracket}</span>
                    {!isExpanded && (
                        <>
                            <span className="json-ellipsis">...</span>
                            <span className="json-bracket">{closeBracket}</span>
                            {!isLast && <span className="json-comma">,</span>}
                        </>
                    )}
                </div>

                {isExpanded && (
                    <div className="json-children">
                        {entries.map(([key, value], index) => (
                            <JsonViewer
                                key={key}
                                name={isArray ? undefined : String(key)}
                                data={value}
                                isLast={index === entries.length - 1}
                                depth={depth + 1}
                            />
                        ))}
                        <div className="json-line">
                            <span className="json-toggle-placeholder">  </span>
                            <span className="json-bracket">{closeBracket}</span>
                            {!isLast && <span className="json-comma">,</span>}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return renderContent();
}
